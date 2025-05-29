package test

import (
	"context"
	"encoding/json"
	"testing"

	"sketch.dev/claudetool"
)

func TestBashTimeout(t *testing.T) {
	// Create a bash tool
	bashTool := claudetool.NewBashTool(nil, claudetool.NoBashToolJITInstall)

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

	// No output should be returned directly, it should be in the error message
	if len(result) > 0 {
		t.Fatalf("Expected no direct output, got: %v", result)
	}

	// The error should contain the partial output
	errorMsg := err.Error()
	if !containsString(errorMsg, "Starting command") || !containsString(errorMsg, "should appear in partial output") {
		t.Errorf("Error should contain the partial output: %v", errorMsg)
	}

	// The error should indicate a timeout
	if !containsString(errorMsg, "timed out") {
		t.Errorf("Error should indicate a timeout: %v", errorMsg)
	}

	// The error should not contain the output that would appear after the sleep
	if containsString(err.Error(), "shouldn't appear") {
		t.Errorf("Error contains output that should not have been captured (after timeout): %s", err.Error())
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
