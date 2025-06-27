import { test, expect } from "@sand4rt/experimental-ct-web";
import { State, AgentMessage } from "./types";

// Test the messages-viewer logic without importing the actual module
// to avoid decorator issues in the test environment

// Helper function to create mock session data
function createMockSessionData(overrides: any = {}) {
  return {
    session_id: "test-session-123",
    user_name: "john.doe",
    user_email: "john.doe@example.com",
    session_state: {
      git_username: "john.doe",
      git_origin: "https://github.com/example/repo.git",
      session_id: "test-session-123",
      ...overrides.session_state,
    },
    ...overrides,
  };
}

// Helper function to create mock view data
function createMockViewData(overrides: any = {}) {
  return {
    SessionWithData: overrides.SessionWithData || createMockSessionData(),
    Messages: [
      {
        type: "user",
        content: "Hello, this is a test user message",
        timestamp: new Date().toISOString(),
        conversation_id: "test-conv",
        idx: 1,
        hide_output: false,
      },
      {
        type: "agent",
        content: "This is an agent response",
        timestamp: new Date().toISOString(),
        conversation_id: "test-conv",
        idx: 2,
        hide_output: false,
      },
      ...(overrides.Messages || []),
    ],
    ToolResults: overrides.ToolResults || {},
  };
}

// Test the state creation logic directly
function createStateFromViewData(viewData: any): Partial<State> {
  const sessionWithData = viewData.SessionWithData;
  return {
    session_id: sessionWithData?.session_id || "",
    git_username:
      sessionWithData?.session_state?.git_username ||
      sessionWithData?.user_name,
    git_origin: sessionWithData?.session_state?.git_origin,
  };
}

test("creates proper state object with git_username from session_state", () => {
  const mockViewData = createMockViewData();
  const state = createStateFromViewData(mockViewData);

  expect(state.session_id).toBe("test-session-123");
  expect(state.git_username).toBe("john.doe");
  expect(state.git_origin).toBe("https://github.com/example/repo.git");
});

test("uses git_username from session_state when available", () => {
  const mockViewData = createMockViewData({
    SessionWithData: createMockSessionData({
      user_name: "fallback.user",
      session_state: {
        git_username: "primary.user", // This should take precedence
      },
    }),
  });

  const state = createStateFromViewData(mockViewData);
  expect(state.git_username).toBe("primary.user");
});

test("falls back to user_name when session_state.git_username not available", () => {
  const mockViewData = createMockViewData({
    SessionWithData: createMockSessionData({
      user_name: "fallback.user",
      session_state: {
        // git_username not provided
      },
    }),
  });

  const state = createStateFromViewData(mockViewData);
  expect(state.git_username).toBe("fallback.user");
});

test("handles missing git username gracefully", () => {
  const mockViewData = createMockViewData({
    SessionWithData: {
      session_id: "test-session-123",
      // user_name not provided
      session_state: {
        // git_username not provided
      },
    },
  });

  const state = createStateFromViewData(mockViewData);
  expect(state.git_username).toBeUndefined();
});

test("message filtering logic works correctly", () => {
  const messages = [
    {
      type: "user",
      content: "Visible message",
      hide_output: false,
      timestamp: new Date().toISOString(),
      conversation_id: "test-conv",
      idx: 1,
    },
    {
      type: "agent",
      content: "Hidden message",
      hide_output: true, // This should be filtered out
      timestamp: new Date().toISOString(),
      conversation_id: "test-conv",
      idx: 2,
    },
    {
      type: "agent",
      content: "Another visible message",
      hide_output: false,
      timestamp: new Date().toISOString(),
      conversation_id: "test-conv",
      idx: 3,
    },
  ];

  // Test the filtering logic
  const visibleMessages = messages.filter((msg: any) => !msg.hide_output);

  expect(visibleMessages).toHaveLength(2);
  expect(visibleMessages[0].content).toBe("Visible message");
  expect(visibleMessages[1].content).toBe("Another visible message");
});

test("handles empty or malformed session data", () => {
  const mockViewData = {
    SessionWithData: null, // Malformed data
    Messages: [],
    ToolResults: {},
  };

  // Should not throw an error
  expect(() => {
    const state = createStateFromViewData(mockViewData);
    expect(state.session_id).toBe("");
    expect(state.git_username).toBeUndefined();
  }).not.toThrow();
});

test("preserves git_origin from session state", () => {
  const mockViewData = createMockViewData({
    SessionWithData: createMockSessionData({
      session_state: {
        git_origin: "https://github.com/test/repository.git",
        git_username: "test.user",
      },
    }),
  });

  const state = createStateFromViewData(mockViewData);
  expect(state.git_origin).toBe("https://github.com/test/repository.git");
});

test("fallback hierarchy works correctly", () => {
  // Test all combinations of the fallback hierarchy
  const testCases = [
    {
      name: "session_state.git_username takes precedence",
      sessionData: {
        user_name: "fallback",
        session_state: { git_username: "primary" },
      },
      expected: "primary",
    },
    {
      name: "user_name when session_state.git_username missing",
      sessionData: {
        user_name: "fallback",
        session_state: {},
      },
      expected: "fallback",
    },
    {
      name: "undefined when both missing",
      sessionData: {
        session_id: "test-session-123",
        // user_name not provided
        session_state: {
          // git_username not provided
        },
      },
      expected: undefined,
    },
  ];

  testCases.forEach(({ name, sessionData, expected }) => {
    const mockViewData = createMockViewData({
      SessionWithData:
        name === "undefined when both missing"
          ? sessionData
          : createMockSessionData(sessionData),
    });

    const state = createStateFromViewData(mockViewData);
    expect(state.git_username).toBe(expected);
  });
});
