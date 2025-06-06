package claudetool

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"sketch.dev/llm"
	"sketch.dev/skabandclient"
)

// CreateSessionHistoryTools creates the session history tools when skaband is available
func CreateSessionHistoryTools(skabandClient *skabandclient.SkabandClient, sessionID, currentRepo string) []*llm.Tool {
	if skabandClient == nil {
		return nil
	}

	return []*llm.Tool{
		listRecentSketchSessionsTool(skabandClient, sessionID, currentRepo),
		readSketchSessionTool(skabandClient, sessionID),
	}
}

func listRecentSketchSessionsTool(client *skabandclient.SkabandClient, sessionID, currentRepo string) *llm.Tool {
	return &llm.Tool{
		Name: "list_recent_sketch_sessions",
		Description: fmt.Sprintf(`Lists recent Sketch sessions%s. Use this tool when the user refers to previous sketch sessions, asks about recent work, or wants to see their session history. This helps you understand what work has been done previously and can provide context for continuing or reviewing past sessions.`, func() string {
			if currentRepo != "" {
				return " for the current repository (" + currentRepo + ")"
			}
			return ""
		}()),
		InputSchema: json.RawMessage(`{
		"type": "object",
		"properties": {},
		"required": []
	}`),
		Run: func(ctx context.Context, input json.RawMessage) ([]llm.Content, error) {
			// Use 60 second timeout for skaband requests
			ctxWithTimeout, cancel := context.WithTimeout(ctx, 60*time.Second)
			defer cancel()

			markdownTable, err := client.ListRecentSketchSessionsMarkdown(ctxWithTimeout, currentRepo, sessionID)
			if err != nil {
				return nil, fmt.Errorf("failed to list recent sessions: %w", err)
			}

			// Check if no sessions found (markdown will contain "No sessions found")
			if strings.Contains(markdownTable, "No sessions found") {
				return llm.TextContent("No recent sketch sessions found."), nil
			}

			// Use the markdown table from the server
			var result strings.Builder
			result.WriteString("Recent sketch sessions:\n\n")
			result.WriteString(markdownTable)
			result.WriteString("\n\nUse the `read_sketch_session` tool with a session ID to see the full conversation history.")

			return llm.TextContent(result.String()), nil
		},
	}
}

func readSketchSessionTool(client *skabandclient.SkabandClient, sessionID string) *llm.Tool {
	return &llm.Tool{
		Name:        "read_sketch_session",
		Description: `Reads the full conversation history of a specific Sketch session. Use this tool when the user mentions a specific sketch session ID, wants to review what was done in a previous session, or needs to understand the context from a past conversation to continue work.`,
		InputSchema: json.RawMessage(`{
		"type": "object",
		"properties": {
			"session_id": {
				"type": "string",
				"description": "The ID of the sketch session to read"
			}
		},
		"required": ["session_id"]
	}`),
		Run: func(ctx context.Context, input json.RawMessage) ([]llm.Content, error) {
			// Use 60 second timeout for skaband requests
			ctxWithTimeout, cancel := context.WithTimeout(ctx, 60*time.Second)
			defer cancel()

			var params struct {
				SessionID string `json:"session_id"`
			}
			if err := json.Unmarshal(input, &params); err != nil {
				return nil, fmt.Errorf("failed to parse input: %w", err)
			}

			if params.SessionID == "" {
				return nil, fmt.Errorf("session_id is required")
			}

			formattedResponse, err := client.ReadSketchSession(ctxWithTimeout, params.SessionID, sessionID)
			if err != nil {
				return nil, fmt.Errorf("failed to read session: %w", err)
			}

			// Server now returns formatted text directly
			return llm.TextContent(*formattedResponse), nil
		},
	}
}
