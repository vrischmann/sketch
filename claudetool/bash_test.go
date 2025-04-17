package claudetool

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestBashRun(t *testing.T) {
	// Test basic functionality
	t.Run("Basic Command", func(t *testing.T) {
		input := json.RawMessage(`{"command":"echo 'Hello, world!'"}`)

		result, err := BashRun(context.Background(), input)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		expected := "Hello, world!\n"
		if result != expected {
			t.Errorf("Expected %q, got %q", expected, result)
		}
	})

	// Test with arguments
	t.Run("Command With Arguments", func(t *testing.T) {
		input := json.RawMessage(`{"command":"echo -n foo && echo -n bar"}`)

		result, err := BashRun(context.Background(), input)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		expected := "foobar"
		if result != expected {
			t.Errorf("Expected %q, got %q", expected, result)
		}
	})

	// Test with timeout parameter
	t.Run("With Timeout", func(t *testing.T) {
		inputObj := struct {
			Command string `json:"command"`
			Timeout string `json:"timeout"`
		}{
			Command: "sleep 0.1 && echo 'Completed'",
			Timeout: "5s",
		}
		inputJSON, err := json.Marshal(inputObj)
		if err != nil {
			t.Fatalf("Failed to marshal input: %v", err)
		}

		result, err := BashRun(context.Background(), inputJSON)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		expected := "Completed\n"
		if result != expected {
			t.Errorf("Expected %q, got %q", expected, result)
		}
	})

	// Test command timeout
	t.Run("Command Timeout", func(t *testing.T) {
		inputObj := struct {
			Command string `json:"command"`
			Timeout string `json:"timeout"`
		}{
			Command: "sleep 0.5 && echo 'Should not see this'",
			Timeout: "100ms",
		}
		inputJSON, err := json.Marshal(inputObj)
		if err != nil {
			t.Fatalf("Failed to marshal input: %v", err)
		}

		_, err = BashRun(context.Background(), inputJSON)
		if err == nil {
			t.Errorf("Expected timeout error, got none")
		} else if !strings.Contains(err.Error(), "timed out") {
			t.Errorf("Expected timeout error, got: %v", err)
		}
	})

	// Test command that fails
	t.Run("Failed Command", func(t *testing.T) {
		input := json.RawMessage(`{"command":"exit 1"}`)

		_, err := BashRun(context.Background(), input)
		if err == nil {
			t.Errorf("Expected error for failed command, got none")
		}
	})

	// Test invalid input
	t.Run("Invalid JSON Input", func(t *testing.T) {
		input := json.RawMessage(`{"command":123}`) // Invalid JSON (command must be string)

		_, err := BashRun(context.Background(), input)
		if err == nil {
			t.Errorf("Expected error for invalid input, got none")
		}
	})
}

func TestExecuteBash(t *testing.T) {
	ctx := context.Background()

	// Test successful command
	t.Run("Successful Command", func(t *testing.T) {
		req := bashInput{
			Command: "echo 'Success'",
			Timeout: "5s",
		}

		output, err := executeBash(ctx, req)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		want := "Success\n"
		if output != want {
			t.Errorf("Expected %q, got %q", want, output)
		}
	})

	// Test command with output to stderr
	t.Run("Command with stderr", func(t *testing.T) {
		req := bashInput{
			Command: "echo 'Error message' >&2 && echo 'Success'",
			Timeout: "5s",
		}

		output, err := executeBash(ctx, req)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		want := "Error message\nSuccess\n"
		if output != want {
			t.Errorf("Expected %q, got %q", want, output)
		}
	})

	// Test command that fails with stderr
	t.Run("Failed Command with stderr", func(t *testing.T) {
		req := bashInput{
			Command: "echo 'Error message' >&2 && exit 1",
			Timeout: "5s",
		}

		_, err := executeBash(ctx, req)
		if err == nil {
			t.Errorf("Expected error for failed command, got none")
		} else if !strings.Contains(err.Error(), "Error message") {
			t.Errorf("Expected stderr in error message, got: %v", err)
		}
	})

	// Test timeout
	t.Run("Command Timeout", func(t *testing.T) {
		req := bashInput{
			Command: "sleep 1 && echo 'Should not see this'",
			Timeout: "100ms",
		}

		start := time.Now()
		_, err := executeBash(ctx, req)
		elapsed := time.Since(start)

		// Command should time out after ~100ms, not wait for full 1 second
		if elapsed >= 1*time.Second {
			t.Errorf("Command did not respect timeout, took %v", elapsed)
		}

		if err == nil {
			t.Errorf("Expected timeout error, got none")
		} else if !strings.Contains(err.Error(), "timed out") {
			t.Errorf("Expected timeout error, got: %v", err)
		}
	})
}
