package oai

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"sketch.dev/llm"
)

// mockRoundTripper is a mock HTTP round tripper that can simulate TLS errors
type mockRoundTripper struct {
	callCount      int
	errorOnAttempt []int // which attempts should return TLS errors
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	m.callCount++

	// Check if this attempt should return a TLS error
	for _, errorAttempt := range m.errorOnAttempt {
		if m.callCount == errorAttempt {
			return nil, errors.New(`Post "https://api.fireworks.ai/inference/v1/chat/completions": remote error: tls: bad record MAC`)
		}
	}

	// Simulate timeout for other cases to avoid actual HTTP calls
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	<-ctx.Done()
	return nil, ctx.Err()
}

func TestTLSBadRecordMACRetry(t *testing.T) {
	tests := []struct {
		name           string
		errorOnAttempt []int
		expectedCalls  int
		shouldSucceed  bool
	}{
		{
			name:           "first attempt succeeds",
			errorOnAttempt: []int{}, // no TLS errors
			expectedCalls:  1,
			shouldSucceed:  false, // will timeout, but that's expected for this test
		},
		{
			name:           "first attempt fails with TLS error, second succeeds",
			errorOnAttempt: []int{1}, // TLS error on first attempt
			expectedCalls:  2,
			shouldSucceed:  false, // will timeout on second attempt
		},
		{
			name:           "both attempts fail with TLS error",
			errorOnAttempt: []int{1, 2}, // TLS error on both attempts
			expectedCalls:  2,
			shouldSucceed:  false, // should fail after second TLS error
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRT := &mockRoundTripper{
				errorOnAttempt: tt.errorOnAttempt,
			}
			mockClient := &http.Client{
				Transport: mockRT,
			}

			service := &Service{
				HTTPC:  mockClient,
				Model:  Qwen3CoderFireworks,
				APIKey: "test-key",
			}

			req := &llm.Request{
				Messages: []llm.Message{
					{Role: llm.MessageRoleUser, Content: []llm.Content{{Type: llm.ContentTypeText, Text: "test"}}},
				},
			}

			_, err := service.Do(context.Background(), req)

			// Verify the expected number of calls were made
			if mockRT.callCount != tt.expectedCalls {
				t.Errorf("expected %d calls, got %d", tt.expectedCalls, mockRT.callCount)
			}

			// For TLS error cases, verify the error message contains both attempts
			if len(tt.errorOnAttempt) > 1 {
				if err == nil {
					t.Error("expected error after multiple TLS failures")
				} else if !strings.Contains(err.Error(), "tls: bad record MAC") {
					t.Errorf("expected error to contain TLS error message, got: %v", err)
				}
			}
		})
	}
}
