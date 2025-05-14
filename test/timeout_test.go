package test

import (
	"context"
	"encoding/json"
	"testing"

	"sketch.dev/claudetool"
	"sketch.dev/llm"
)

func TestBashTimeout(t *testing.T) {
	// Create a bash tool
	bashTool := claudetool.NewBashTool(nil)

	// Create a command that will output text and then sleep
	cmd := `echo "Starting command..."; echo "This should appear in partial output"; sleep 5; echo "This shouldn't appear"`

	// Prepare the input with a very short timeout
	input := map[string]any{
		"command": cmd,
		"timeout": "1s", // Very short timeout to trigger the timeout case
	}

	// Marshal the input to JSON
	inputJSON, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("Failed to marshal input: %v", err)
	}

	// Run the bash tool
	ctx := context.Background()
	result, err := bashTool.Run(ctx, inputJSON)

	// Check that we got an error (due to timeout)
	if err == nil {
		t.Fatalf("Expected timeout error, got nil")
	}

	// Error should mention timeout
	if !containsString(err.Error(), "timed out") {
		t.Errorf("Error doesn't mention timeout: %v", err)
	}

	// Check that we got partial output despite the error
	if len(result) == 0 {
		t.Fatalf("Expected partial output, got empty result")
	}

	// Verify the error mentions that partial output is included
	if !containsString(err.Error(), "partial output included") {
		t.Errorf("Error should mention that partial output is included: %v", err)
	}

	// The partial output should contain the initial output but not the text after sleep
	text := ""
	for _, content := range result {
		if content.Type == llm.ContentTypeText {
			text += content.Text
		}
	}

	if !containsString(text, "Starting command") || !containsString(text, "should appear in partial output") {
		t.Errorf("Partial output is missing expected content: %s", text)
	}

	if containsString(text, "shouldn't appear") {
		t.Errorf("Partial output contains unexpected content (after timeout): %s", text)
	}
}

func containsString(s, substr string) bool {
	return s != "" && s != "<nil>" && stringIndexOf(s, substr) >= 0
}

func stringIndexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
