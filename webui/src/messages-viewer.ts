import { SketchTimeline } from "./web-components/sketch-timeline";
import { aggregateAgentMessages } from "./web-components/aggregateAgentMessages";

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
  //timelineEl.scrollContainer = window.document;
  container.replaceWith(timelineEl);
}

window.globalThis.renderMessagesViewer = renderMessagesViewer;
