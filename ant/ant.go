package ant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/oklog/ulid/v2"
	"github.com/richardlehane/crock32"
	"sketch.dev/skribe"
)

const (
	DefaultModel = Claude37Sonnet
	// See https://docs.anthropic.com/en/docs/about-claude/models/all-models for
	// current maximums. There's currently a flag to enable 128k output (output-128k-2025-02-19)
	DefaultMaxTokens = 8192
	DefaultURL       = "https://api.anthropic.com/v1/messages"
)

const (
	Claude35Sonnet = "claude-3-5-sonnet-20241022"
	Claude35Haiku  = "claude-3-5-haiku-20241022"
	Claude37Sonnet = "claude-3-7-sonnet-20250219"
)

const (
	MessageRoleUser      = "user"
	MessageRoleAssistant = "assistant"

	ContentTypeText             = "text"
	ContentTypeThinking         = "thinking"
	ContentTypeRedactedThinking = "redacted_thinking"
	ContentTypeToolUse          = "tool_use"
	ContentTypeToolResult       = "tool_result"

	StopReasonStopSequence = "stop_sequence"
	StopReasonMaxTokens    = "max_tokens"
	StopReasonEndTurn      = "end_turn"
	StopReasonToolUse      = "tool_use"
)

type Listener interface {
	// TODO: Content is leaking an anthropic API; should we avoid it?
	// TODO: Where should we include start/end time and usage?
	OnToolCall(ctx context.Context, convo *Convo, toolCallID string, toolName string, toolInput json.RawMessage, content Content)
	OnToolResult(ctx context.Context, convo *Convo, toolCallID string, toolName string, toolInput json.RawMessage, content Content, result *string, err error)
	OnRequest(ctx context.Context, convo *Convo, requestID string, msg *Message)
	OnResponse(ctx context.Context, convo *Convo, requestID string, msg *MessageResponse)
}

type NoopListener struct{}

func (n *NoopListener) OnToolCall(ctx context.Context, convo *Convo, id string, toolName string, toolInput json.RawMessage, content Content) {
}

func (n *NoopListener) OnToolResult(ctx context.Context, convo *Convo, id string, toolName string, toolInput json.RawMessage, content Content, result *string, err error) {
}

func (n *NoopListener) OnResponse(ctx context.Context, convo *Convo, id string, msg *MessageResponse) {
}
func (n *NoopListener) OnRequest(ctx context.Context, convo *Convo, id string, msg *Message) {}

type Content struct {
	// TODO: image support?
	// https://docs.anthropic.com/en/api/messages
	ID   string `json:"id,omitempty"`
	Type string `json:"type,omitempty"`
	Text string `json:"text,omitempty"`

	// for thinking
	Thinking  string `json:"thinking,omitempty"`
	Data      string `json:"data,omitempty"`      // for redacted_thinking
	Signature string `json:"signature,omitempty"` // for thinking

	// for tool_use
	ToolName  string          `json:"name,omitempty"`
	ToolInput json.RawMessage `json:"input,omitempty"`

	// for tool_result
	ToolUseID  string `json:"tool_use_id,omitempty"`
	ToolError  bool   `json:"is_error,omitempty"`
	ToolResult string `json:"content,omitempty"`

	// timing information for tool_result; not sent to Claude
	StartTime *time.Time `json:"-"`
	EndTime   *time.Time `json:"-"`

	CacheControl json.RawMessage `json:"cache_control,omitempty"`
}

func StringContent(s string) Content {
	return Content{Type: ContentTypeText, Text: s}
}

// Message represents a message in the conversation.
type Message struct {
	Role    string    `json:"role"`
	Content []Content `json:"content"`
	ToolUse *ToolUse  `json:"tool_use,omitempty"` // use to control whether/which tool to use
}

// ToolUse represents a tool use in the message content.
type ToolUse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Tool represents a tool available to Claude.
type Tool struct {
	Name string `json:"name"`
	// Type is used by the text editor tool; see
	// https://docs.anthropic.com/en/docs/build-with-claude/tool-use/text-editor-tool
	Type        string          `json:"type,omitempty"`
	Description string          `json:"description,omitempty"`
	InputSchema json.RawMessage `json:"input_schema,omitempty"`

	// The Run function is automatically called when the tool is used.
	// Run functions may be called concurrently with each other and themselves.
	// The input to Run function is the input to the tool, as provided by Claude, in compliance with the input schema.
	// The outputs from Run will be sent back to Claude.
	// If you do not want to respond to the tool call request from Claude, return ErrDoNotRespond.
	// ctx contains extra (rarely used) tool call information; retrieve it with ToolCallInfoFromContext.
	Run func(ctx context.Context, input json.RawMessage) (string, error) `json:"-"`
}

var ErrDoNotRespond = errors.New("do not respond")

// Usage represents the billing and rate-limit usage.
type Usage struct {
	InputTokens              uint64  `json:"input_tokens"`
	CacheCreationInputTokens uint64  `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     uint64  `json:"cache_read_input_tokens"`
	OutputTokens             uint64  `json:"output_tokens"`
	CostUSD                  float64 `json:"cost_usd"`
}

func (u *Usage) Add(other Usage) {
	u.InputTokens += other.InputTokens
	u.CacheCreationInputTokens += other.CacheCreationInputTokens
	u.CacheReadInputTokens += other.CacheReadInputTokens
	u.OutputTokens += other.OutputTokens
	u.CostUSD += other.CostUSD
}

func (u *Usage) String() string {
	return fmt.Sprintf("in: %d, out: %d", u.InputTokens, u.OutputTokens)
}

func (u *Usage) IsZero() bool {
	return *u == Usage{}
}

func (u *Usage) Attr() slog.Attr {
	return slog.Group("usage",
		slog.Uint64("input_tokens", u.InputTokens),
		slog.Uint64("output_tokens", u.OutputTokens),
		slog.Uint64("cache_creation_input_tokens", u.CacheCreationInputTokens),
		slog.Uint64("cache_read_input_tokens", u.CacheReadInputTokens),
	)
}

type ErrorResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// MessageResponse represents the response from the message API.
type MessageResponse struct {
	ID           string     `json:"id"`
	Type         string     `json:"type"`
	Role         string     `json:"role"`
	Model        string     `json:"model"`
	Content      []Content  `json:"content"`
	StopReason   string     `json:"stop_reason"`
	StopSequence *string    `json:"stop_sequence,omitempty"`
	Usage        Usage      `json:"usage"`
	StartTime    *time.Time `json:"start_time,omitempty"`
	EndTime      *time.Time `json:"end_time,omitempty"`
}

func (m *MessageResponse) ToMessage() Message {
	return Message{
		Role:    m.Role,
		Content: m.Content,
	}
}

func (m *MessageResponse) StopSequenceString() string {
	if m.StopSequence == nil {
		return ""
	}
	return *m.StopSequence
}

const (
	ToolChoiceTypeAuto = "auto" // default
	ToolChoiceTypeAny  = "any"  // any tool, but must use one
	ToolChoiceTypeNone = "none" // no tools allowed
	ToolChoiceTypeTool = "tool" // must use the tool specified in the Name field
)

type ToolChoice struct {
	Type string `json:"type"`
	Name string `json:"name,omitempty"`
}

// https://docs.anthropic.com/en/api/messages#body-system
type SystemContent struct {
	Text         string          `json:"text,omitempty"`
	Type         string          `json:"type,omitempty"`
	CacheControl json.RawMessage `json:"cache_control,omitempty"`
}

// MessageRequest represents the request payload for creating a message.
type MessageRequest struct {
	Model         string          `json:"model"`
	Messages      []Message       `json:"messages"`
	ToolChoice    *ToolChoice     `json:"tool_choice,omitempty"`
	MaxTokens     int             `json:"max_tokens"`
	Tools         []*Tool         `json:"tools,omitempty"`
	Stream        bool            `json:"stream,omitempty"`
	System        []SystemContent `json:"system,omitempty"`
	Temperature   float64         `json:"temperature,omitempty"`
	TopK          int             `json:"top_k,omitempty"`
	TopP          float64         `json:"top_p,omitempty"`
	StopSequences []string        `json:"stop_sequences,omitempty"`

	TokenEfficientToolUse bool `json:"-"` // DO NOT USE, broken on Anthropic's side as of 2025-02-28
}

const dumpText = false // debugging toggle to see raw communications with Claude

// createMessage sends a request to the Anthropic message API to create a message.
func createMessage(ctx context.Context, httpc *http.Client, url, apiKey string, request *MessageRequest) (*MessageResponse, error) {
	var payload []byte
	var err error
	if dumpText || testing.Testing() {
		payload, err = json.MarshalIndent(request, "", " ")
	} else {
		payload, err = json.Marshal(request)
		payload = append(payload, '\n')
	}
	if err != nil {
		return nil, err
	}

	if false {
		fmt.Printf("claude request payload:\n%s\n", payload)
	}

	backoff := []time.Duration{15 * time.Second, 30 * time.Second, time.Minute}
	largerMaxTokens := false
	var partialUsage Usage

	// retry loop
	for attempts := 0; ; attempts++ {
		if dumpText {
			fmt.Printf("RAW REQUEST:\n%s\n\n", payload)
		}
		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
		if err != nil {
			return nil, err
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", apiKey)
		req.Header.Set("Anthropic-Version", "2023-06-01")

		features := []string{}

		if request.TokenEfficientToolUse {
			features = append(features, "token-efficient-tool-use-2025-02-19")
		}
		if largerMaxTokens {
			features = append(features, "output-128k-2025-02-19")
			request.MaxTokens = 128 * 1024
		}
		if len(features) > 0 {
			req.Header.Set("anthropic-beta", strings.Join(features, ","))
		}

		resp, err := httpc.Do(req)
		if err != nil {
			return nil, err
		}
		buf, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		switch {
		case resp.StatusCode == http.StatusOK:
			if dumpText {
				fmt.Printf("RAW RESPONSE:\n%s\n\n", buf)
			}
			var response MessageResponse
			err = json.NewDecoder(bytes.NewReader(buf)).Decode(&response)
			if err != nil {
				return nil, err
			}
			if response.StopReason == StopReasonMaxTokens && !largerMaxTokens {
				fmt.Printf("Retrying Anthropic API call with larger max tokens size.")
				// Retry with more output tokens.
				largerMaxTokens = true
				response.Usage.CostUSD = response.TotalDollars()
				partialUsage = response.Usage
				continue
			}

			// Calculate and set the cost_usd field
			if largerMaxTokens {
				response.Usage.Add(partialUsage)
			}
			response.Usage.CostUSD = response.TotalDollars()

			return &response, nil
		case resp.StatusCode >= 500 && resp.StatusCode < 600:
			// overloaded or unhappy, in one form or another
			sleep := backoff[min(attempts, len(backoff)-1)] + time.Duration(rand.Int64N(int64(time.Second)))
			slog.WarnContext(ctx, "anthropic_request_failed", "response", string(buf), "status_code", resp.StatusCode, "sleep", sleep)
			time.Sleep(sleep)
		case resp.StatusCode == 429:
			// rate limited. wait 1 minute as a starting point, because that's the rate limiting window.
			// and then add some additional time for backoff.
			sleep := time.Minute + backoff[min(attempts, len(backoff)-1)] + time.Duration(rand.Int64N(int64(time.Second)))
			slog.WarnContext(ctx, "anthropic_request_rate_limited", "response", string(buf), "sleep", sleep)
			time.Sleep(sleep)
		// case resp.StatusCode == 400:
		// TODO: parse ErrorResponse, make (*ErrorResponse) implement error
		default:
			return nil, fmt.Errorf("API request failed with status %s\n%s", resp.Status, buf)
		}
	}
}

// A Convo is a managed conversation with Claude.
// It automatically manages the state of the conversation,
// including appending messages send/received,
// calling tools and sending their results,
// tracking usage, etc.
//
// Exported fields must not be altered concurrently with calling any method on Convo.
// Typical usage is to configure a Convo once before using it.
type Convo struct {
	// ID is a unique ID for the conversation
	ID string
	// Ctx is the context for the entire conversation.
	Ctx context.Context
	// HTTPC is the HTTP client for the conversation.
	HTTPC *http.Client
	// URL is the remote messages URL to dial.
	URL string
	// APIKey is the API key for the conversation.
	APIKey string
	// Model is the model for the conversation.
	Model string
	// MaxTokens is the max tokens for each response in the conversation.
	MaxTokens int
	// Tools are the tools available during the conversation.
	Tools []*Tool
	// SystemPrompt is the system prompt for the conversation.
	SystemPrompt string
	// PromptCaching indicates whether to use Anthropic's prompt caching.
	// See https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#continuing-a-multi-turn-conversation
	// for the documentation. At request send time, we set the cache_control field on the
	// last message. We also cache the system prompt.
	// Default: true.
	PromptCaching bool
	// ToolUseOnly indicates whether Claude may only use tools during this conversation.
	// TODO: add more fine-grained control over tool use?
	ToolUseOnly bool
	// Parent is the parent conversation, if any.
	// It is non-nil for "subagent" calls.
	// It is set automatically when calling SubConvo,
	// and usually should not be set manually.
	Parent *Convo
	// Budget is the budget for this conversation (and all sub-conversations).
	// The Conversation DOES NOT automatically enforce the budget.
	// It is up to the caller to call OverBudget() as appropriate.
	Budget Budget

	// messages tracks the messages so far in the conversation.
	messages []Message

	// Listener receives messages being sent.
	Listener Listener

	muToolUseCancel *sync.Mutex
	toolUseCancel   map[string]context.CancelCauseFunc

	// Protects usage. This is used for subconversations (that share part of CumulativeUsage) as well.
	mu *sync.Mutex
	// usage tracks usage for this conversation and all sub-conversations.
	usage *CumulativeUsage
}

// newConvoID generates a new 8-byte random id.
// The uniqueness/collision requirements here are very low.
// They are not global identifiers,
// just enough to distinguish different convos in a single session.
func newConvoID() string {
	u1 := rand.Uint32()
	s := crock32.Encode(uint64(u1))
	if len(s) < 7 {
		s += strings.Repeat("0", 7-len(s))
	}
	return s[:3] + "-" + s[3:]
}

// NewConvo creates a new conversation with Claude with sensible defaults.
// ctx is the context for the entire conversation.
func NewConvo(ctx context.Context, apiKey string) *Convo {
	id := newConvoID()
	return &Convo{
		Ctx:             skribe.ContextWithAttr(ctx, slog.String("convo_id", id)),
		HTTPC:           http.DefaultClient,
		URL:             DefaultURL,
		APIKey:          apiKey,
		Model:           DefaultModel,
		MaxTokens:       DefaultMaxTokens,
		PromptCaching:   true,
		usage:           newUsage(),
		Listener:        &NoopListener{},
		ID:              id,
		muToolUseCancel: &sync.Mutex{},
		toolUseCancel:   map[string]context.CancelCauseFunc{},
		mu:              &sync.Mutex{},
	}
}

// SubConvo creates a sub-conversation with the same configuration as the parent conversation.
// (This propagates context for cancellation, HTTP client, API key, etc.)
// The sub-conversation shares no messages with the parent conversation.
// It does not inherit tools from the parent conversation.
func (c *Convo) SubConvo() *Convo {
	id := newConvoID()
	return &Convo{
		Ctx:           skribe.ContextWithAttr(c.Ctx, slog.String("convo_id", id), slog.String("parent_convo_id", c.ID)),
		HTTPC:         c.HTTPC,
		URL:           c.URL,
		APIKey:        c.APIKey,
		Model:         c.Model,
		MaxTokens:     c.MaxTokens,
		PromptCaching: c.PromptCaching,
		Parent:        c,
		// For convenience, sub-convo usage shares tool uses map with parent,
		// all other fields separate, propagated in AddResponse
		usage:    newUsageWithSharedToolUses(c.usage),
		mu:       c.mu,
		Listener: c.Listener,
		ID:       id,
		// Do not copy Budget. Each budget is independent,
		// and OverBudget checks whether any ancestor is over budget.
	}
}

func (c *Convo) SubConvoWithHistory() *Convo {
	id := newConvoID()
	return &Convo{
		Ctx:           skribe.ContextWithAttr(c.Ctx, slog.String("convo_id", id), slog.String("parent_convo_id", c.ID)),
		HTTPC:         c.HTTPC,
		URL:           c.URL,
		APIKey:        c.APIKey,
		Model:         c.Model,
		MaxTokens:     c.MaxTokens,
		PromptCaching: c.PromptCaching,
		Parent:        c,
		// For convenience, sub-convo usage shares tool uses map with parent,
		// all other fields separate, propagated in AddResponse
		usage:    newUsageWithSharedToolUses(c.usage),
		mu:       c.mu,
		Listener: c.Listener,
		ID:       id,
		// Do not copy Budget. Each budget is independent,
		// and OverBudget checks whether any ancestor is over budget.
		messages: slices.Clone(c.messages),
	}
}

// Depth reports how many "sub-conversations" deep this conversation is.
// That it, it walks up parents until it finds a root.
func (c *Convo) Depth() int {
	x := c
	var depth int
	for x.Parent != nil {
		x = x.Parent
		depth++
	}
	return depth
}

// SendUserTextMessage sends a text message to Claude in this conversation.
// otherContents contains additional contents to send with the message, usually tool results.
func (c *Convo) SendUserTextMessage(s string, otherContents ...Content) (*MessageResponse, error) {
	contents := slices.Clone(otherContents)
	if s != "" {
		contents = append(contents, StringContent(s))
	}
	msg := Message{
		Role:    MessageRoleUser,
		Content: contents,
	}
	return c.SendMessage(msg)
}

func (c *Convo) messageRequest(msg Message) *MessageRequest {
	system := []SystemContent{}
	if c.SystemPrompt != "" {
		var d SystemContent
		d = SystemContent{Type: ContentTypeText, Text: c.SystemPrompt}
		if c.PromptCaching {
			d.CacheControl = json.RawMessage(`{"type":"ephemeral"}`)
		}
		system = []SystemContent{d}
	}

	// Claude is happy to return an empty response in response to our Done() call,
	// and, if so, you'll see something like:
	// API request failed with status 400 Bad Request
	// {"type":"error","error":  {"type":"invalid_request_error",
	// "message":"messages.5: all messages must have non-empty content except for the optional final assistant message"}}
	// So, we filter out those empty messages.
	var nonEmptyMessages []Message
	for _, m := range c.messages {
		if len(m.Content) > 0 {
			nonEmptyMessages = append(nonEmptyMessages, m)
		}
	}

	mr := &MessageRequest{
		Model:     c.Model,
		Messages:  append(nonEmptyMessages, msg), // not yet committed to keeping msg
		System:    system,
		Tools:     c.Tools,
		MaxTokens: c.MaxTokens,
	}
	if c.ToolUseOnly {
		mr.ToolChoice = &ToolChoice{Type: ToolChoiceTypeAny}
	}
	return mr
}

func (c *Convo) findTool(name string) (*Tool, error) {
	for _, tool := range c.Tools {
		if tool.Name == name {
			return tool, nil
		}
	}
	return nil, fmt.Errorf("tool %q not found", name)
}

// insertMissingToolResults adds error results for tool uses that were requested
// but not included in the message, which can happen in error paths like "out of budget."
// We only insert these if there were no tool responses at all, since an incorrect
// number of tool results would be a programmer error. Mutates inputs.
func (c *Convo) insertMissingToolResults(mr *MessageRequest, msg *Message) {
	if len(mr.Messages) < 2 {
		return
	}
	prev := mr.Messages[len(mr.Messages)-2]
	var toolUsePrev int
	for _, c := range prev.Content {
		if c.Type == ContentTypeToolUse {
			toolUsePrev++
		}
	}
	if toolUsePrev == 0 {
		return
	}
	var toolUseCurrent int
	for _, c := range msg.Content {
		if c.Type == ContentTypeToolResult {
			toolUseCurrent++
		}
	}
	if toolUseCurrent != 0 {
		return
	}
	var prefix []Content
	for _, part := range prev.Content {
		if part.Type != ContentTypeToolUse {
			continue
		}
		content := Content{
			Type:       ContentTypeToolResult,
			ToolUseID:  part.ID,
			ToolError:  true,
			ToolResult: "not executed; retry possible",
		}
		prefix = append(prefix, content)
		msg.Content = append(prefix, msg.Content...)
		mr.Messages[len(mr.Messages)-1].Content = msg.Content
	}
	slog.DebugContext(c.Ctx, "inserted missing tool results")
}

// SendMessage sends a message to Claude.
// The conversation records (internally) all messages succesfully sent and received.
func (c *Convo) SendMessage(msg Message) (*MessageResponse, error) {
	id := ulid.Make().String()
	mr := c.messageRequest(msg)
	var lastMessage *Message
	if c.PromptCaching {
		lastMessage = &mr.Messages[len(mr.Messages)-1]
		if len(lastMessage.Content) > 0 {
			lastMessage.Content[len(lastMessage.Content)-1].CacheControl = json.RawMessage(`{"type":"ephemeral"}`)
		}
	}
	defer func() {
		if lastMessage == nil {
			return
		}
		if len(lastMessage.Content) > 0 {
			lastMessage.Content[len(lastMessage.Content)-1].CacheControl = []byte{}
		}
	}()
	c.insertMissingToolResults(mr, &msg)
	c.Listener.OnRequest(c.Ctx, c, id, &msg)

	startTime := time.Now()
	resp, err := createMessage(c.Ctx, c.HTTPC, c.URL, c.APIKey, mr)
	if resp != nil {
		resp.StartTime = &startTime
		endTime := time.Now()
		resp.EndTime = &endTime
	}

	if err != nil {
		c.Listener.OnResponse(c.Ctx, c, id, nil)
		return nil, err
	}
	c.messages = append(c.messages, msg, resp.ToMessage())
	// Propagate usage to all ancestors (including us).
	for x := c; x != nil; x = x.Parent {
		x.usage.AddResponse(resp)
	}
	c.Listener.OnResponse(c.Ctx, c, id, resp)
	return resp, err
}

type toolCallInfoKeyType string

var toolCallInfoKey toolCallInfoKeyType

type ToolCallInfo struct {
	ToolUseID string
	Convo     *Convo
}

func ToolCallInfoFromContext(ctx context.Context) ToolCallInfo {
	v := ctx.Value(toolCallInfoKey)
	i, _ := v.(ToolCallInfo)
	return i
}

func (c *Convo) ToolResultCancelContents(resp *MessageResponse) ([]Content, error) {
	if resp.StopReason != StopReasonToolUse {
		return nil, nil
	}
	var toolResults []Content

	for _, part := range resp.Content {
		if part.Type != ContentTypeToolUse {
			continue
		}
		c.incrementToolUse(part.ToolName)

		content := Content{
			Type:      ContentTypeToolResult,
			ToolUseID: part.ID,
		}

		content.ToolError = true
		content.ToolResult = "user canceled this too_use"
		toolResults = append(toolResults, content)
	}
	return toolResults, nil
}

// GetID returns the conversation ID
func (c *Convo) GetID() string {
	return c.ID
}

func (c *Convo) CancelToolUse(toolUseID string, err error) error {
	c.muToolUseCancel.Lock()
	defer c.muToolUseCancel.Unlock()
	cancel, ok := c.toolUseCancel[toolUseID]
	if !ok {
		return fmt.Errorf("cannot cancel %s: no cancel function registered for this tool_use_id. All I have is %+v", toolUseID, c.toolUseCancel)
	}
	delete(c.toolUseCancel, toolUseID)
	cancel(err)
	return nil
}

func (c *Convo) newToolUseContext(ctx context.Context, toolUseID string) (context.Context, context.CancelFunc) {
	c.muToolUseCancel.Lock()
	defer c.muToolUseCancel.Unlock()
	ctx, cancel := context.WithCancelCause(ctx)
	c.toolUseCancel[toolUseID] = cancel
	return ctx, func() { c.CancelToolUse(toolUseID, nil) }
}

// ToolResultContents runs all tool uses requested by the response and returns their results.
// Cancelling ctx will cancel any running tool calls.
func (c *Convo) ToolResultContents(ctx context.Context, resp *MessageResponse) ([]Content, error) {
	if resp.StopReason != StopReasonToolUse {
		return nil, nil
	}
	// Extract all tool calls from the response, call the tools, and gather the results.
	var wg sync.WaitGroup
	toolResultC := make(chan Content, len(resp.Content))
	for _, part := range resp.Content {
		if part.Type != ContentTypeToolUse {
			continue
		}
		c.incrementToolUse(part.ToolName)
		startTime := time.Now()

		c.Listener.OnToolCall(ctx, c, part.ID, part.ToolName, part.ToolInput, Content{
			Type:      ContentTypeToolUse,
			ToolUseID: part.ID,
			StartTime: &startTime,
		})

		wg.Add(1)
		go func() {
			defer wg.Done()

			content := Content{
				Type:      ContentTypeToolResult,
				ToolUseID: part.ID,
				StartTime: &startTime,
			}
			sendErr := func(err error) {
				// Record end time
				endTime := time.Now()
				content.EndTime = &endTime

				content.ToolError = true
				content.ToolResult = err.Error()
				c.Listener.OnToolResult(ctx, c, part.ID, part.ToolName, part.ToolInput, content, nil, err)
				toolResultC <- content
			}
			sendRes := func(res string) {
				// Record end time
				endTime := time.Now()
				content.EndTime = &endTime

				content.ToolResult = res
				c.Listener.OnToolResult(ctx, c, part.ID, part.ToolName, part.ToolInput, content, &res, nil)
				toolResultC <- content
			}

			tool, err := c.findTool(part.ToolName)
			if err != nil {
				sendErr(err)
				return
			}
			// Create a new context for just this tool_use call, and register its
			// cancel function so that it can be canceled individually.
			toolUseCtx, cancel := c.newToolUseContext(ctx, part.ID)
			defer cancel()
			// TODO: move this into newToolUseContext?
			toolUseCtx = context.WithValue(toolUseCtx, toolCallInfoKey, ToolCallInfo{ToolUseID: part.ID, Convo: c})
			toolResult, err := tool.Run(toolUseCtx, part.ToolInput)
			if errors.Is(err, ErrDoNotRespond) {
				return
			}
			if toolUseCtx.Err() != nil {
				sendErr(context.Cause(toolUseCtx))
				return
			}

			if err != nil {
				sendErr(err)
				return
			}
			sendRes(toolResult)
		}()
	}
	wg.Wait()
	close(toolResultC)
	var toolResults []Content
	for toolResult := range toolResultC {
		toolResults = append(toolResults, toolResult)
	}
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return toolResults, nil
}

func (c *Convo) incrementToolUse(name string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.usage.ToolUses[name]++
}

// ContentsAttr returns contents as a slog.Attr.
// It is meant for logging.
func ContentsAttr(contents []Content) slog.Attr {
	var contentAttrs []any // slog.Attr
	for _, content := range contents {
		var attrs []any // slog.Attr
		switch content.Type {
		case ContentTypeText:
			attrs = append(attrs, slog.String("text", content.Text))
		case ContentTypeToolUse:
			attrs = append(attrs, slog.String("tool_name", content.ToolName))
			attrs = append(attrs, slog.String("tool_input", string(content.ToolInput)))
		case ContentTypeToolResult:
			attrs = append(attrs, slog.String("tool_result", content.ToolResult))
			attrs = append(attrs, slog.Bool("tool_error", content.ToolError))
		case ContentTypeThinking:
			attrs = append(attrs, slog.String("thinking", content.Text))
		default:
			attrs = append(attrs, slog.String("unknown_content_type", content.Type))
			attrs = append(attrs, slog.Any("text", content)) // just log it all raw, better to have too much than not enough
		}
		contentAttrs = append(contentAttrs, slog.Group(content.ID, attrs...))
	}
	return slog.Group("contents", contentAttrs...)
}

// MustSchema validates that schema is a valid JSON schema and returns it as a json.RawMessage.
// It panics if the schema is invalid.
func MustSchema(schema string) json.RawMessage {
	// TODO: validate schema, for now just make sure it's valid JSON
	schema = strings.TrimSpace(schema)
	bytes := []byte(schema)
	if !json.Valid(bytes) {
		panic("invalid JSON schema: " + schema)
	}
	return json.RawMessage(bytes)
}

// cents per million tokens
// (not dollars because i'm twitchy about using floats for money)
type centsPer1MTokens struct {
	Input         uint64
	Output        uint64
	CacheRead     uint64
	CacheCreation uint64
}

// https://www.anthropic.com/pricing#anthropic-api
var modelCost = map[string]centsPer1MTokens{
	Claude37Sonnet: {
		Input:         300,  // $3
		Output:        1500, // $15
		CacheRead:     30,   // $0.30
		CacheCreation: 375,  // $3.75
	},
	Claude35Haiku: {
		Input:         80,  // $0.80
		Output:        400, // $4.00
		CacheRead:     8,   // $0.08
		CacheCreation: 100, // $1.00
	},
	Claude35Sonnet: {
		Input:         300,  // $3
		Output:        1500, // $15
		CacheRead:     30,   // $0.30
		CacheCreation: 375,  // $3.75
	},
}

// TotalDollars returns the total cost to obtain this response, in dollars.
func (mr *MessageResponse) TotalDollars() float64 {
	cpm, ok := modelCost[mr.Model]
	if !ok {
		panic(fmt.Sprintf("no pricing info for model: %s", mr.Model))
	}
	use := mr.Usage
	megaCents := use.InputTokens*cpm.Input +
		use.OutputTokens*cpm.Output +
		use.CacheReadInputTokens*cpm.CacheRead +
		use.CacheCreationInputTokens*cpm.CacheCreation
	cents := float64(megaCents) / 1_000_000.0
	return cents / 100.0
}

func newUsage() *CumulativeUsage {
	return &CumulativeUsage{ToolUses: make(map[string]int), StartTime: time.Now()}
}

func newUsageWithSharedToolUses(parent *CumulativeUsage) *CumulativeUsage {
	return &CumulativeUsage{ToolUses: parent.ToolUses, StartTime: time.Now()}
}

// CumulativeUsage represents cumulative usage across a Convo, including all sub-conversations.
type CumulativeUsage struct {
	StartTime                time.Time      `json:"start_time"`
	Responses                uint64         `json:"messages"` // count of responses
	InputTokens              uint64         `json:"input_tokens"`
	OutputTokens             uint64         `json:"output_tokens"`
	CacheReadInputTokens     uint64         `json:"cache_read_input_tokens"`
	CacheCreationInputTokens uint64         `json:"cache_creation_input_tokens"`
	TotalCostUSD             float64        `json:"total_cost_usd"`
	ToolUses                 map[string]int `json:"tool_uses"` // tool name -> number of uses
}

func (u *CumulativeUsage) Clone() CumulativeUsage {
	v := *u
	v.ToolUses = maps.Clone(u.ToolUses)
	return v
}

func (c *Convo) CumulativeUsage() CumulativeUsage {
	if c == nil {
		return CumulativeUsage{}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.usage.Clone()
}

func (u *CumulativeUsage) WallTime() time.Duration {
	return time.Since(u.StartTime)
}

func (u *CumulativeUsage) DollarsPerHour() float64 {
	hours := u.WallTime().Hours()
	if hours == 0 {
		return 0
	}
	return u.TotalCostUSD / hours
}

func (u *CumulativeUsage) AddResponse(resp *MessageResponse) {
	usage := resp.Usage
	u.Responses++
	u.InputTokens += usage.InputTokens
	u.OutputTokens += usage.OutputTokens
	u.CacheReadInputTokens += usage.CacheReadInputTokens
	u.CacheCreationInputTokens += usage.CacheCreationInputTokens
	u.TotalCostUSD += resp.TotalDollars()
}

// TotalInputTokens returns the grand total cumulative input tokens in u.
func (u *CumulativeUsage) TotalInputTokens() uint64 {
	return u.InputTokens + u.CacheReadInputTokens + u.CacheCreationInputTokens
}

// Attr returns the cumulative usage as a slog.Attr with key "usage".
func (u CumulativeUsage) Attr() slog.Attr {
	elapsed := time.Since(u.StartTime)
	return slog.Group("usage",
		slog.Duration("wall_time", elapsed),
		slog.Uint64("responses", u.Responses),
		slog.Uint64("input_tokens", u.InputTokens),
		slog.Uint64("output_tokens", u.OutputTokens),
		slog.Uint64("cache_read_input_tokens", u.CacheReadInputTokens),
		slog.Uint64("cache_creation_input_tokens", u.CacheCreationInputTokens),
		slog.Float64("total_cost_usd", u.TotalCostUSD),
		slog.Float64("dollars_per_hour", u.TotalCostUSD/elapsed.Hours()),
		slog.Any("tool_uses", maps.Clone(u.ToolUses)),
	)
}

// A Budget represents the maximum amount of resources that may be spent on a conversation.
// Note that the default (zero) budget is unlimited.
type Budget struct {
	MaxResponses uint64        // if > 0, max number of iterations (=responses)
	MaxDollars   float64       // if > 0, max dollars that may be spent
	MaxWallTime  time.Duration // if > 0, max wall time that may be spent
}

// OverBudget returns an error if the convo (or any of its parents) has exceeded its budget.
// TODO: document parent vs sub budgets, multiple errors, etc, once we know the desired behavior.
func (c *Convo) OverBudget() error {
	for x := c; x != nil; x = x.Parent {
		if err := x.overBudget(); err != nil {
			return err
		}
	}
	return nil
}

// ResetBudget sets the budget to the passed in budget and
// adjusts it by what's been used so far.
func (c *Convo) ResetBudget(budget Budget) {
	c.Budget = budget
	if c.Budget.MaxDollars > 0 {
		c.Budget.MaxDollars += c.CumulativeUsage().TotalCostUSD
	}
	if c.Budget.MaxResponses > 0 {
		c.Budget.MaxResponses += c.CumulativeUsage().Responses
	}
	if c.Budget.MaxWallTime > 0 {
		c.Budget.MaxWallTime += c.usage.WallTime()
	}
}

func (c *Convo) overBudget() error {
	usage := c.CumulativeUsage()
	// TODO: stop before we exceed the budget instead of after?
	// Top priority is money, then time, then response count.
	var err error
	cont := "Continuing to chat will reset the budget."
	if c.Budget.MaxDollars > 0 && usage.TotalCostUSD >= c.Budget.MaxDollars {
		err = errors.Join(err, fmt.Errorf("$%.2f spent, budget is $%.2f. %s", usage.TotalCostUSD, c.Budget.MaxDollars, cont))
	}
	if c.Budget.MaxWallTime > 0 && usage.WallTime() >= c.Budget.MaxWallTime {
		err = errors.Join(err, fmt.Errorf("%v elapsed, budget is %v. %s", usage.WallTime().Truncate(time.Second), c.Budget.MaxWallTime.Truncate(time.Second), cont))
	}
	if c.Budget.MaxResponses > 0 && usage.Responses >= c.Budget.MaxResponses {
		err = errors.Join(err, fmt.Errorf("%d responses received, budget is %d. %s", usage.Responses, c.Budget.MaxResponses, cont))
	}
	return err
}

// UserStringMessage creates a user message with a single text content item.
func UserStringMessage(text string) Message {
	return Message{
		Role:    MessageRoleUser,
		Content: []Content{StringContent(text)},
	}
}
