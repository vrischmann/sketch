/**
 * Centralized exports for all demo fixtures
 */

// Tool calls
export {
  sampleToolCalls,
  longBashCommand,
  multipleToolCallGroups,
} from "./tool-calls";

// Timeline messages
export {
  sampleTimelineMessages,
  longTimelineMessage,
  mixedTimelineMessages,
} from "./timeline-messages";

// Container status
export {
  sampleUsage,
  sampleContainerState,
  lightUsageState,
  heavyUsageState,
} from "./container-status";

// View mode select
export {
  sampleViewModeConfigs,
  viewModeScenarios,
  applyViewModeConfig,
  createViewModeTestButtons,
} from "./view-mode-select";

// Call status
export {
  idleCallStatus,
  workingCallStatus,
  heavyWorkingCallStatus,
  disconnectedCallStatus,
  workingDisconnectedCallStatus,
} from "./call-status";
export type { CallStatusState } from "./call-status";

// Common demo utilities
export const demoStyles = {
  container: `
    max-width: 1200px;
    margin: 20px auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `,

  demoSection: `
    margin: 20px 0;
    padding: 15px;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    background: #f8f9fa;
  `,

  demoHeader: `
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #24292f;
  `,
};

/**
 * Common demo setup utilities
 */
export const demoUtils = {
  /**
   * Create a labeled demo section
   */
  createDemoSection(title: string, description?: string): HTMLElement {
    const section = document.createElement("div");
    section.style.cssText = demoStyles.demoSection;

    const header = document.createElement("h3");
    header.style.cssText = demoStyles.demoHeader;
    header.textContent = title;
    section.appendChild(header);

    if (description) {
      const desc = document.createElement("p");
      desc.textContent = description;
      desc.style.cssText = "color: #656d76; margin-bottom: 15px;";
      section.appendChild(desc);
    }

    return section;
  },

  /**
   * Wait for a specified number of milliseconds
   */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Create a simple button for demo interactions
   */
  createButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
      padding: 8px 16px;
      margin: 5px;
      background: #0969da;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `;
    button.addEventListener("click", onClick);
    return button;
  },
};
