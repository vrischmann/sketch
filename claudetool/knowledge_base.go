package claudetool

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"text/template"

	"sketch.dev/llm"
	"sketch.dev/llm/conversation"
)

// KnowledgeBase provides on-demand specialized knowledge to the agent.
var KnowledgeBase = &llm.Tool{
	Name:        kbName,
	Description: kbDescription,
	InputSchema: llm.MustSchema(kbInputSchema),
	Run:         kbRun,
}

// TODO: BYO knowledge bases? could do that for strings.Lines, for example.
// TODO: support Q&A mode instead of reading full text in?

const (
	kbName        = "knowledge_base"
	kbDescription = `Retrieve specialized information that you need but don't have in your context.

When to use this tool:

For the "sketch" topic:
- The user is asking how to USE Sketch itself (not asking Sketch to perform a task)
- The user has questions about Sketch functionality, setup, or capabilities
- The user needs help with Sketch-specific concepts like running commands, secrets management, git integration
- The query is about "How do I do X in Sketch?" or "Is it possible to Y in Sketch?" or just "Help"
- The user is confused about how a Sketch feature works or how to access it
- You need to know how to interact with the host machine, ed forwarding a port or pulling changes that the user has made outside of Sketch

For the "strings_lines" topic:
- Any mentions of strings.Lines in the code, by the codereview, or by the user
- When implementing code that iterates over lines in a Go string

Available topics:
- sketch: documentation on Sketch usage
- strings_lines: details about the Go strings.Lines API
`

	kbInputSchema = `
{
  "type": "object",
  "required": ["topic"],
  "properties": {
    "topic": {
      "type": "string",
      "description": "Topic to retrieve information about",
      "enum": ["sketch", "strings_lines"]
    }
  }
}
`
)

type kbInput struct {
	Topic string `json:"topic"`
}

//go:embed kb/sketch.txt
var sketchContent string

//go:embed kb/strings_lines.txt
var stringsLinesContent string

var sketchTemplate = template.Must(template.New("sketch").Parse(sketchContent))

func kbRun(ctx context.Context, m json.RawMessage) ([]llm.Content, error) {
	var input kbInput
	if err := json.Unmarshal(m, &input); err != nil {
		return nil, err
	}

	// Sanitize topic name (simple lowercase conversion for now)
	topic := strings.ToLower(strings.TrimSpace(input.Topic))
	slog.InfoContext(ctx, "knowledge base request", "topic", topic)

	// Process content based on topic
	switch input.Topic {
	case "sketch":
		info := conversation.ToolCallInfoFromContext(ctx)
		sessionID, _ := info.Convo.ExtraData["session_id"].(string)
		branch, _ := info.Convo.ExtraData["branch"].(string)
		dot := struct {
			SessionID string
			Branch    string
		}{
			SessionID: sessionID,
			Branch:    branch,
		}
		buf := new(strings.Builder)
		if err := sketchTemplate.Execute(buf, dot); err != nil {
			return nil, fmt.Errorf("template execution error: %w", err)
		}
		return llm.TextContent(buf.String()), nil
	case "strings_lines":
		// No special processing for other topics
		return llm.TextContent(stringsLinesContent), nil
	default:
		return nil, fmt.Errorf("unknown topic: %s", input.Topic)
	}
}
