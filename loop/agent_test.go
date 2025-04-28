package loop

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"sketch.dev/ant"
	"sketch.dev/httprr"
)

// TestAgentLoop tests that the Agent loop functionality works correctly.
// It uses the httprr package to record HTTP interactions for replay in tests.
// When failing, rebuild with "go test ./sketch/loop -run TestAgentLoop -httprecord .*agent_loop.*"
// as necessary.
func TestAgentLoop(t *testing.T) {
	ctx := context.Background()

	// Setup httprr recorder
	rrPath := "testdata/agent_loop.httprr"
	rr, err := httprr.Open(rrPath, http.DefaultTransport)
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}

	if rr.Recording() {
		// Skip the test if API key is not available
		if os.Getenv("ANTHROPIC_API_KEY") == "" {
			t.Fatal("ANTHROPIC_API_KEY not set, required for HTTP recording")
		}
	}

	// Create HTTP client
	var client *http.Client
	if rr != nil {
		// Scrub API keys from requests for security
		rr.ScrubReq(func(req *http.Request) error {
			req.Header.Del("x-api-key")
			req.Header.Del("anthropic-api-key")
			return nil
		})
		client = rr.Client()
	} else {
		client = &http.Client{Transport: http.DefaultTransport}
	}

	// Create a new agent with the httprr client
	origWD, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir("/"); err != nil {
		t.Fatal(err)
	}
	budget := ant.Budget{MaxResponses: 100}
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}

	cfg := AgentConfig{
		Context:      ctx,
		APIKey:       os.Getenv("ANTHROPIC_API_KEY"),
		HTTPC:        client,
		Budget:       budget,
		GitUsername:  "Test Agent",
		GitEmail:     "totallyhuman@sketch.dev",
		SessionID:    "test-session-id",
		ClientGOOS:   "linux",
		ClientGOARCH: "amd64",
	}
	agent := NewAgent(cfg)
	if err := os.Chdir(origWD); err != nil {
		t.Fatal(err)
	}
	err = agent.Init(AgentInit{WorkingDir: wd, NoGit: true})
	if err != nil {
		t.Fatal(err)
	}

	// Setup a test message that will trigger a simple, predictable response
	userMessage := "What tools are available to you? Please just list them briefly."

	// Send the message to the agent
	agent.UserMessage(ctx, userMessage)

	// Process a single loop iteration to avoid long-running tests
	agent.processTurn(ctx)

	// Collect responses with a timeout
	var responses []AgentMessage
	timeout := time.After(10 * time.Second)
	done := false

	for !done {
		select {
		case <-timeout:
			t.Log("Timeout reached while waiting for agent responses")
			done = true
		default:
			select {
			case msg := <-agent.outbox:
				t.Logf("Received message: Type=%s, EndOfTurn=%v, Content=%q", msg.Type, msg.EndOfTurn, msg.Content)
				responses = append(responses, msg)
				if msg.EndOfTurn {
					done = true
				}
			default:
				// No more messages available right now
				time.Sleep(100 * time.Millisecond)
			}
		}
	}

	// Verify we got at least one response
	if len(responses) == 0 {
		t.Fatal("No responses received from agent")
	}

	// Log the received responses for debugging
	t.Logf("Received %d responses", len(responses))

	// Find the final agent response (with EndOfTurn=true)
	var finalResponse *AgentMessage
	for i := range responses {
		if responses[i].Type == AgentMessageType && responses[i].EndOfTurn {
			finalResponse = &responses[i]
			break
		}
	}

	// Verify we got a final agent response
	if finalResponse == nil {
		t.Fatal("No final agent response received")
	}

	// Check that the response contains tools information
	if !strings.Contains(strings.ToLower(finalResponse.Content), "tool") {
		t.Error("Expected response to mention tools")
	}

	// Count how many tool use messages we received
	toolUseCount := 0
	for _, msg := range responses {
		if msg.Type == ToolUseMessageType {
			toolUseCount++
		}
	}

	t.Logf("Agent used %d tools in its response", toolUseCount)
}

func TestAgentTracksOutstandingCalls(t *testing.T) {
	agent := &Agent{
		outstandingLLMCalls:  make(map[string]struct{}),
		outstandingToolCalls: make(map[string]string),
	}

	// Check initial state
	if count := agent.OutstandingLLMCallCount(); count != 0 {
		t.Errorf("Expected 0 outstanding LLM calls, got %d", count)
	}

	if tools := agent.OutstandingToolCalls(); len(tools) != 0 {
		t.Errorf("Expected 0 outstanding tool calls, got %d", len(tools))
	}

	// Add some calls
	agent.mu.Lock()
	agent.outstandingLLMCalls["llm1"] = struct{}{}
	agent.outstandingToolCalls["tool1"] = "bash"
	agent.outstandingToolCalls["tool2"] = "think"
	agent.mu.Unlock()

	// Check tracking works
	if count := agent.OutstandingLLMCallCount(); count != 1 {
		t.Errorf("Expected 1 outstanding LLM call, got %d", count)
	}

	tools := agent.OutstandingToolCalls()
	if len(tools) != 2 {
		t.Errorf("Expected 2 outstanding tool calls, got %d", len(tools))
	}

	// Check removal
	agent.mu.Lock()
	delete(agent.outstandingLLMCalls, "llm1")
	delete(agent.outstandingToolCalls, "tool1")
	agent.mu.Unlock()

	if count := agent.OutstandingLLMCallCount(); count != 0 {
		t.Errorf("Expected 0 outstanding LLM calls after removal, got %d", count)
	}

	tools = agent.OutstandingToolCalls()
	if len(tools) != 1 {
		t.Errorf("Expected 1 outstanding tool call after removal, got %d", len(tools))
	}

	if tools[0] != "think" {
		t.Errorf("Expected 'think' tool remaining, got %s", tools[0])
	}
}

// TestAgentProcessTurnWithNilResponse tests the scenario where Agent.processTurn receives
// a nil value for initialResp from processUserMessage.
func TestAgentProcessTurnWithNilResponse(t *testing.T) {
	// Create a mock conversation that will return nil and error
	mockConvo := &MockConvoInterface{
		sendMessageFunc: func(message ant.Message) (*ant.MessageResponse, error) {
			return nil, fmt.Errorf("test error: simulating nil response")
		},
	}

	// Create a minimal Agent instance for testing
	agent := &Agent{
		convo:                mockConvo,
		inbox:                make(chan string, 10),
		outbox:               make(chan AgentMessage, 10),
		outstandingLLMCalls:  make(map[string]struct{}),
		outstandingToolCalls: make(map[string]string),
	}

	// Create a test context
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Push a test message to the inbox so that processUserMessage will try to process it
	agent.inbox <- "Test message"

	// Call processTurn - it should exit early without panic when initialResp is nil
	agent.processTurn(ctx)

	// Verify the error message was added to outbox
	select {
	case msg := <-agent.outbox:
		if msg.Type != ErrorMessageType {
			t.Errorf("Expected error message, got message type: %s", msg.Type)
		}
		if !strings.Contains(msg.Content, "simulating nil response") {
			t.Errorf("Expected error message to contain 'simulating nil response', got: %s", msg.Content)
		}
	case <-time.After(time.Second):
		t.Error("Timed out waiting for error message in outbox")
	}

	// No more messages should be in the outbox since processTurn should exit early
	select {
	case msg := <-agent.outbox:
		t.Errorf("Expected no more messages in outbox, but got: %+v", msg)
	case <-time.After(100 * time.Millisecond):
		// This is the expected outcome - no more messages
	}
}

// MockConvoInterface implements the ConvoInterface for testing
type MockConvoInterface struct {
	sendMessageFunc              func(message ant.Message) (*ant.MessageResponse, error)
	sendUserTextMessageFunc      func(s string, otherContents ...ant.Content) (*ant.MessageResponse, error)
	toolResultContentsFunc       func(ctx context.Context, resp *ant.MessageResponse) ([]ant.Content, error)
	toolResultCancelContentsFunc func(resp *ant.MessageResponse) ([]ant.Content, error)
	cancelToolUseFunc            func(toolUseID string, cause error) error
	cumulativeUsageFunc          func() ant.CumulativeUsage
	resetBudgetFunc              func(ant.Budget)
	overBudgetFunc               func() error
	getIDFunc                    func() string
	subConvoWithHistoryFunc      func() *ant.Convo
}

func (m *MockConvoInterface) SendMessage(message ant.Message) (*ant.MessageResponse, error) {
	if m.sendMessageFunc != nil {
		return m.sendMessageFunc(message)
	}
	return nil, nil
}

func (m *MockConvoInterface) SendUserTextMessage(s string, otherContents ...ant.Content) (*ant.MessageResponse, error) {
	if m.sendUserTextMessageFunc != nil {
		return m.sendUserTextMessageFunc(s, otherContents...)
	}
	return nil, nil
}

func (m *MockConvoInterface) ToolResultContents(ctx context.Context, resp *ant.MessageResponse) ([]ant.Content, error) {
	if m.toolResultContentsFunc != nil {
		return m.toolResultContentsFunc(ctx, resp)
	}
	return nil, nil
}

func (m *MockConvoInterface) ToolResultCancelContents(resp *ant.MessageResponse) ([]ant.Content, error) {
	if m.toolResultCancelContentsFunc != nil {
		return m.toolResultCancelContentsFunc(resp)
	}
	return nil, nil
}

func (m *MockConvoInterface) CancelToolUse(toolUseID string, cause error) error {
	if m.cancelToolUseFunc != nil {
		return m.cancelToolUseFunc(toolUseID, cause)
	}
	return nil
}

func (m *MockConvoInterface) CumulativeUsage() ant.CumulativeUsage {
	if m.cumulativeUsageFunc != nil {
		return m.cumulativeUsageFunc()
	}
	return ant.CumulativeUsage{}
}

func (m *MockConvoInterface) ResetBudget(budget ant.Budget) {
	if m.resetBudgetFunc != nil {
		m.resetBudgetFunc(budget)
	}
}

func (m *MockConvoInterface) OverBudget() error {
	if m.overBudgetFunc != nil {
		return m.overBudgetFunc()
	}
	return nil
}

func (m *MockConvoInterface) GetID() string {
	if m.getIDFunc != nil {
		return m.getIDFunc()
	}
	return "mock-convo-id"
}

func (m *MockConvoInterface) SubConvoWithHistory() *ant.Convo {
	if m.subConvoWithHistoryFunc != nil {
		return m.subConvoWithHistoryFunc()
	}
	return nil
}

// TestAgentProcessTurnWithNilResponseNilError tests the scenario where Agent.processTurn receives
// a nil value for initialResp and nil error from processUserMessage.
// This test verifies that the implementation properly handles this edge case.
func TestAgentProcessTurnWithNilResponseNilError(t *testing.T) {
	// Create a mock conversation that will return nil response and nil error
	mockConvo := &MockConvoInterface{
		sendMessageFunc: func(message ant.Message) (*ant.MessageResponse, error) {
			return nil, nil // This is unusual but now handled gracefully
		},
	}

	// Create a minimal Agent instance for testing
	agent := &Agent{
		convo:                mockConvo,
		inbox:                make(chan string, 10),
		outbox:               make(chan AgentMessage, 10),
		outstandingLLMCalls:  make(map[string]struct{}),
		outstandingToolCalls: make(map[string]string),
	}

	// Create a test context
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Push a test message to the inbox so that processUserMessage will try to process it
	agent.inbox <- "Test message"

	// Call processTurn - it should handle nil initialResp with a descriptive error
	err := agent.processTurn(ctx)

	// Verify we get the expected error
	if err == nil {
		t.Error("Expected processTurn to return an error for nil initialResp, but got nil")
	} else if !strings.Contains(err.Error(), "unexpected nil response") {
		t.Errorf("Expected error about nil response, got: %v", err)
	} else {
		t.Logf("As expected, processTurn returned error: %v", err)
	}

	// Verify an error message was sent to the outbox
	select {
	case msg := <-agent.outbox:
		if msg.Type != ErrorMessageType {
			t.Errorf("Expected error message type, got: %s", msg.Type)
		}
		if !strings.Contains(msg.Content, "unexpected nil response") {
			t.Errorf("Expected error about nil response, got: %s", msg.Content)
		}
	case <-time.After(time.Second):
		t.Error("Timed out waiting for error message in outbox")
	}
}
