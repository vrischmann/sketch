package loop

import (
	"context"
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
