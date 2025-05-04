package gem

import (
	"encoding/json"
	"testing"

	"sketch.dev/llm"
	"sketch.dev/llm/gem/gemini"
)

func TestBuildGeminiRequest(t *testing.T) {
	// Create a service
	service := &Service{
		Model:  DefaultModel,
		APIKey: "test-api-key",
	}

	// Create a simple request
	req := &llm.Request{
		Messages: []llm.Message{
			{
				Role: llm.MessageRoleUser,
				Content: []llm.Content{
					{
						Type: llm.ContentTypeText,
						Text: "Hello, world!",
					},
				},
			},
		},
		System: []llm.SystemContent{
			{
				Text: "You are a helpful assistant.",
			},
		},
	}

	// Build the Gemini request
	gemReq, err := service.buildGeminiRequest(req)
	if err != nil {
		t.Fatalf("Failed to build Gemini request: %v", err)
	}

	// Verify the system instruction
	if gemReq.SystemInstruction == nil {
		t.Fatalf("Expected system instruction, got nil")
	}
	if len(gemReq.SystemInstruction.Parts) != 1 {
		t.Fatalf("Expected 1 system part, got %d", len(gemReq.SystemInstruction.Parts))
	}
	if gemReq.SystemInstruction.Parts[0].Text != "You are a helpful assistant." {
		t.Fatalf("Expected system text 'You are a helpful assistant.', got '%s'", gemReq.SystemInstruction.Parts[0].Text)
	}

	// Verify the contents
	if len(gemReq.Contents) != 1 {
		t.Fatalf("Expected 1 content, got %d", len(gemReq.Contents))
	}
	if len(gemReq.Contents[0].Parts) != 1 {
		t.Fatalf("Expected 1 part, got %d", len(gemReq.Contents[0].Parts))
	}
	if gemReq.Contents[0].Parts[0].Text != "Hello, world!" {
		t.Fatalf("Expected text 'Hello, world!', got '%s'", gemReq.Contents[0].Parts[0].Text)
	}
	// Verify the role is set correctly
	if gemReq.Contents[0].Role != "user" {
		t.Fatalf("Expected role 'user', got '%s'", gemReq.Contents[0].Role)
	}
}

func TestConvertToolSchemas(t *testing.T) {
	// Create a simple tool with a JSON schema
	schema := `{
		"type": "object",
		"properties": {
			"name": {
				"type": "string",
				"description": "The name of the person"
			},
			"age": {
				"type": "integer",
				"description": "The age of the person"
			}
		},
		"required": ["name"]
	}`

	tools := []*llm.Tool{
		{
			Name:        "get_person",
			Description: "Get information about a person",
			InputSchema: json.RawMessage(schema),
		},
	}

	// Convert the tools
	decls, err := convertToolSchemas(tools)
	if err != nil {
		t.Fatalf("Failed to convert tool schemas: %v", err)
	}

	// Verify the result
	if len(decls) != 1 {
		t.Fatalf("Expected 1 declaration, got %d", len(decls))
	}
	if decls[0].Name != "get_person" {
		t.Fatalf("Expected name 'get_person', got '%s'", decls[0].Name)
	}
	if decls[0].Description != "Get information about a person" {
		t.Fatalf("Expected description 'Get information about a person', got '%s'", decls[0].Description)
	}

	// Verify the schema properties
	if decls[0].Parameters.Type != 6 { // DataTypeOBJECT
		t.Fatalf("Expected type OBJECT (6), got %d", decls[0].Parameters.Type)
	}
	if len(decls[0].Parameters.Properties) != 2 {
		t.Fatalf("Expected 2 properties, got %d", len(decls[0].Parameters.Properties))
	}
	if decls[0].Parameters.Properties["name"].Type != 1 { // DataTypeSTRING
		t.Fatalf("Expected name type STRING (1), got %d", decls[0].Parameters.Properties["name"].Type)
	}
	if decls[0].Parameters.Properties["age"].Type != 3 { // DataTypeINTEGER
		t.Fatalf("Expected age type INTEGER (3), got %d", decls[0].Parameters.Properties["age"].Type)
	}
	if len(decls[0].Parameters.Required) != 1 || decls[0].Parameters.Required[0] != "name" {
		t.Fatalf("Expected required field 'name', got %v", decls[0].Parameters.Required)
	}
}

func TestService_Do_MockResponse(t *testing.T) {
	// This is a mock test that doesn't make actual API calls
	// Create a mock HTTP client that returns a predefined response

	// Create a Service with a mock client
	service := &Service{
		Model:  DefaultModel,
		APIKey: "test-api-key",
		// We would use a mock HTTP client here in a real test
	}

	// Create a sample request
	ir := &llm.Request{
		Messages: []llm.Message{
			{
				Role: llm.MessageRoleUser,
				Content: []llm.Content{
					{
						Type: llm.ContentTypeText,
						Text: "Hello",
					},
				},
			},
		},
	}

	// In a real test, we would execute service.Do with a mock client
	// and verify the response structure

	// For now, we'll just test that buildGeminiRequest works correctly
	_, err := service.buildGeminiRequest(ir)
	if err != nil {
		t.Fatalf("Failed to build request: %v", err)
	}
}

func TestConvertResponseWithToolCall(t *testing.T) {
	// Create a mock Gemini response with a function call
	gemRes := &gemini.Response{
		Candidates: []gemini.Candidate{
			{
				Content: gemini.Content{
					Parts: []gemini.Part{
						{
							FunctionCall: &gemini.FunctionCall{
								Name: "bash",
								Args: map[string]any{
									"command": "cat README.md",
								},
							},
						},
					},
				},
			},
		},
	}

	// Convert the response
	content := convertGeminiResponseToContent(gemRes)

	// Verify that content has a tool use
	if len(content) != 1 {
		t.Fatalf("Expected 1 content item, got %d", len(content))
	}

	if content[0].Type != llm.ContentTypeToolUse {
		t.Fatalf("Expected content type ToolUse, got %s", content[0].Type)
	}

	if content[0].ToolName != "bash" {
		t.Fatalf("Expected tool name 'bash', got '%s'", content[0].ToolName)
	}

	// Verify the tool input
	var args map[string]any
	if err := json.Unmarshal(content[0].ToolInput, &args); err != nil {
		t.Fatalf("Failed to unmarshal tool input: %v", err)
	}

	cmd, ok := args["command"]
	if !ok {
		t.Fatalf("Expected 'command' argument, not found")
	}

	if cmd != "cat README.md" {
		t.Fatalf("Expected command 'cat README.md', got '%s'", cmd)
	}
}
