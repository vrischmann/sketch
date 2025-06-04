package main

import (
	"os"
	"testing"
)

func TestExpandTilde(t *testing.T) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to get home directory: %v", err)
	}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"tilde only", "~", homeDir},
		{"tilde with path", "~/Documents", homeDir + "/Documents"},
		{"no tilde", "/absolute/path", "/absolute/path"},
		{"tilde in middle", "/path/~/middle", "/path/~/middle"},
		{"relative path", "relative/path", "relative/path"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := expandTilde(tt.input)
			if err != nil {
				t.Errorf("expandTilde(%q) returned error: %v", tt.input, err)
			}
			if result != tt.expected {
				t.Errorf("expandTilde(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
