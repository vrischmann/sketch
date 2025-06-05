import { test, expect } from "@sand4rt/experimental-ct-web";
import { SketchContainerStatus } from "./sketch-container-status";
import { State } from "../types";

// Mock complete state for testing
const mockCompleteState: State = {
  state_version: 2,
  hostname: "test-host",
  working_dir: "/test/dir",
  initial_commit: "abcdef1234567890",
  message_count: 42,
  os: "linux",
  title: "Test Session",
  total_usage: {
    input_tokens: 1000,
    output_tokens: 2000,
    cache_read_input_tokens: 300,
    cache_creation_input_tokens: 400,
    total_cost_usd: 0.25,
    start_time: "",
    messages: 0,
    tool_uses: {},
  },
  outstanding_llm_calls: 0,
  outstanding_tool_calls: [],
  session_id: "test-session-id",
  ssh_available: false,
  in_container: true,
  first_message_index: 0,
};

test("render props", async ({ mount }) => {
  const component = await mount(SketchContainerStatus, {
    props: {
      state: mockCompleteState,
    },
  });
  await expect(component.locator("#hostname")).toContainText(
    mockCompleteState.hostname,
  );
  // Check that all expected elements exist
  await expect(component.locator("#workingDir")).toContainText(
    mockCompleteState.working_dir,
  );
  
  // Show details to access the popup elements
  component.locator(".info-toggle").click();
  
  await expect(component.locator("#initialCommit")).toContainText(
    mockCompleteState.initial_commit.substring(0, 8),
  );

  await expect(component.locator("#messageCount")).toContainText(
    mockCompleteState.message_count + "",
  );
  const expectedTotalInputTokens =
    mockCompleteState.total_usage.input_tokens +
    mockCompleteState.total_usage.cache_read_input_tokens +
    mockCompleteState.total_usage.cache_creation_input_tokens;
  await expect(component.locator("#inputTokens")).toContainText(
    expectedTotalInputTokens.toLocaleString(),
  );
  await expect(component.locator("#outputTokens")).toContainText(
    mockCompleteState.total_usage.output_tokens.toLocaleString(),
  );
  await expect(component.locator("#totalCost")).toContainText(
    "$" + mockCompleteState.total_usage.total_cost_usd.toFixed(2),
  );
});



test("renders with partial state data", async ({ mount }) => {
  const partialState: Partial<State> = {
    state_version: 2,
    hostname: "partial-host",
    message_count: 10,
    os: "linux",
    title: "Partial Test",
    session_id: "partial-session",
    ssh_available: false,
    total_usage: {
      input_tokens: 500,
      start_time: "",
      messages: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      total_cost_usd: 0,
      tool_uses: {},
    },
  };

  const component = await mount(SketchContainerStatus, {
    props: {
      state: partialState as State,
    },
  });

  // Check that elements with data are properly populated
  await expect(component.locator("#hostname")).toContainText("partial-host");
  
  // Show details to access the popup elements
  component.locator(".info-toggle").click();
  await expect(component.locator("#messageCount")).toContainText("10");

  const expectedTotalInputTokens =
    partialState.total_usage.input_tokens +
    partialState.total_usage.cache_read_input_tokens +
    partialState.total_usage.cache_creation_input_tokens;
  await expect(component.locator("#inputTokens")).toContainText(
    expectedTotalInputTokens.toLocaleString(),
  );

  // Check that elements without data are empty
  await expect(component.locator("#workingDir")).toContainText("");
  await expect(component.locator("#initialCommit")).toContainText("");
  await expect(component.locator("#outputTokens")).toContainText("0");
  // totalCost element should not exist when cost is 0
  await expect(component.locator("#totalCost")).toHaveCount(0);
});


