import { SketchTimeline } from "./web-components/sketch-timeline";
import { aggregateAgentMessages } from "./web-components/aggregateAgentMessages";
import { State } from "./types";

// Ensure this dependency ends up in the bundle (the "as SketchTimeline" reference below
// is insufficient for the bundler to include it).
SketchTimeline;

export function renderMessagesViewer(viewData: any, container: HTMLDivElement) {
  const timelineEl = document.createElement(
    "sketch-timeline",
  ) as SketchTimeline;
  // Filter out hidden messages at the display level (matches sketch behavior)
  const visibleMessages = viewData.Messages.filter(
    (msg: any) => !msg.hide_output,
  );
  const messages = aggregateAgentMessages(visibleMessages, []);
  timelineEl.messages = messages;
  timelineEl.toolCalls = viewData.ToolResults;
  timelineEl.scrollContainer = { value: window.document.body };

  // Create a state object for the timeline component
  // This ensures user attribution works in archived messages
  const sessionWithData = viewData.SessionWithData;
  const state: Partial<State> = {
    session_id: sessionWithData?.session_id || "",
    // Use git_username from session state if available, fallback to UserName field, then extract from session info
    git_username:
      sessionWithData?.session_state?.git_username ||
      sessionWithData?.user_name ||
      extractGitUsername(sessionWithData),
    // Include other relevant state fields that might be available
    git_origin: sessionWithData?.session_state?.git_origin,
  };

  timelineEl.state = state as State;
  container.replaceWith(timelineEl);
}

// Helper function to extract git username from session data
function extractGitUsername(sessionWithData: any): string | undefined {
  // Try to extract from session state first
  if (sessionWithData?.session_state?.git_username) {
    return sessionWithData.session_state.git_username;
  }

  // For older sessions, we might not have git_username stored
  // We could try to extract it from other sources, but for now return undefined
  return undefined;
}

window.globalThis.renderMessagesViewer = renderMessagesViewer;
