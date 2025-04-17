import { TimelineMessage } from "../types";

/**
 * Adds collapsible functionality to long content elements.
 * This creates a toggle button that allows users to expand/collapse long text content.
 *
 * @param message - The timeline message containing the content
 * @param textEl - The DOM element containing the text content
 * @param containerEl - The container element for the text and copy button
 * @param contentEl - The outer content element that will contain everything
 */
export function addCollapsibleFunctionality(
  message: TimelineMessage,
  textEl: HTMLElement,
  containerEl: HTMLElement,
  contentEl: HTMLElement
): void {
  // Don't collapse end_of_turn messages (final output) regardless of length
  if (message.content.length > 1000 && !message.end_of_turn) {
    textEl.classList.add("collapsed");

    const toggleButton = document.createElement("button");
    toggleButton.className = "collapsible";
    toggleButton.textContent = "Show more...";
    toggleButton.addEventListener("click", () => {
      textEl.classList.toggle("collapsed");
      toggleButton.textContent = textEl.classList.contains("collapsed")
        ? "Show more..."
        : "Show less";
    });

    contentEl.appendChild(containerEl);
    contentEl.appendChild(toggleButton);
  } else {
    contentEl.appendChild(containerEl);
  }
}
