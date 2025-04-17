/**
 * Utility functions for rendering tool calls in the timeline
 */

import { ToolCall, TimelineMessage } from "./types";
import { html, render } from "lit-html";

/**
 * Create a tool call card element for display in the timeline
 * @param toolCall The tool call data to render
 * @param toolResponse Optional tool response message if available
 * @param toolCardId Unique ID for this tool card
 * @returns The created tool card element
 */
export function createToolCallCard(
  toolCall: ToolCall,
  toolResponse?: TimelineMessage | null,
  toolCardId?: string
): HTMLElement {
  // Create a unique ID for this tool card if not provided
  const cardId =
    toolCardId ||
    `tool-card-${
      toolCall.tool_call_id || Math.random().toString(36).substring(2, 11)
    }`;

  // Get input as compact string
  let inputText = "";
  try {
    if (toolCall.input) {
      const parsedInput = JSON.parse(toolCall.input);

      // For bash commands, use a special format
      if (toolCall.name === "bash" && parsedInput.command) {
        inputText = parsedInput.command;
      } else {
        // For other tools, use the stringified JSON
        inputText = JSON.stringify(parsedInput);
      }
    }
  } catch (e) {
    // Not valid JSON, use as-is
    inputText = toolCall.input || "";
  }

  // Truncate input text for display
  const displayInput =
    inputText.length > 80 ? inputText.substring(0, 78) + "..." : inputText;

  // Truncate for compact display
  const shortInput =
    displayInput.length > 30
      ? displayInput.substring(0, 28) + "..."
      : displayInput;

  // Format input for expanded view
  let formattedInput = displayInput;
  try {
    const parsedInput = JSON.parse(toolCall.input || "");
    formattedInput = JSON.stringify(parsedInput, null, 2);
  } catch (e) {
    // Not valid JSON, use display input as-is
  }

  // Truncate result for compact display if available
  let shortResult = "";
  if (toolResponse && toolResponse.tool_result) {
    shortResult =
      toolResponse.tool_result.length > 40
        ? toolResponse.tool_result.substring(0, 38) + "..."
        : toolResponse.tool_result;
  }

  // State for collapsed/expanded view
  let isCollapsed = true;

  // Handler to copy text to clipboard
  const copyToClipboard = (text: string, button: HTMLElement) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text:", err);
        button.textContent = "Failed";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 2000);
      });
  };

  const cancelToolCall = async(tool_call_id: string, button: HTMLButtonElement) => {
    console.log('cancelToolCall', tool_call_id, button);
    button.innerText = 'Cancelling';
    button.disabled = true;
    try {
      const response = await fetch("cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({tool_call_id: tool_call_id, reason: "user requested cancellation" }),
      });
      console.log('cancel', tool_call_id, response);
      button.parentElement.removeChild(button);
    } catch (e) {
      console.error('cancel', tool_call_id,e);
    }
  };

  // Create the container element
  const container = document.createElement("div");
  container.id = cardId;
  container.className = "tool-call-card collapsed";

  // Function to render the component
  const renderComponent = () => {
    const template = html`
      <div
        class="tool-call-compact-view"
        @click=${() => {
          isCollapsed = !isCollapsed;
          container.classList.toggle("collapsed");
          renderComponent();
        }}
      >
        <span class="tool-call-status ${toolResponse ? "" : "spinner"}">
          ${toolResponse ? (toolResponse.tool_error ? "❌" : "✅") : "⏳"}
        </span>
        <span class="tool-call-name">${toolCall.name}</span>
        <code class="tool-call-input-preview">${shortInput}</code>
        ${toolResponse && toolResponse.tool_result
          ? html`<code class="tool-call-result-preview">${shortResult}</code>`
          : ""}
        ${toolResponse && toolResponse.elapsed !== undefined
          ? html`<span class="tool-call-time"
              >${(toolResponse.elapsed / 1e9).toFixed(2)}s</span
            >`
          : ""}
          ${toolResponse ? "" : 
            html`<button class="refresh-button stop-button" title="Cancel this operation" @click=${(e: Event) => {
                e.stopPropagation(); // Don't toggle expansion when clicking cancel
                const button = e.target as HTMLButtonElement;
                cancelToolCall(toolCall.tool_call_id, button);
              }}>Cancel</button>`}
        <span class="tool-call-expand-icon">${isCollapsed ? "▼" : "▲"}</span>
      </div>

      <div class="tool-call-expanded-view">
        <div class="tool-call-section">
          <div class="tool-call-section-label">
            Input:
            <button
              class="tool-call-copy-btn"
              title="Copy input to clipboard"
              @click=${(e: Event) => {
                e.stopPropagation(); // Don't toggle expansion when clicking copy
                const button = e.target as HTMLElement;
                copyToClipboard(toolCall.input || displayInput, button);
              }}
            >
              Copy
            </button>
          </div>
          <div class="tool-call-section-content">
            <pre class="tool-call-input">${formattedInput}</pre>
          </div>
        </div>

        ${toolResponse && toolResponse.tool_result
          ? html`
              <div class="tool-call-section">
                <div class="tool-call-section-label">
                  Result:
                  <button
                    class="tool-call-copy-btn"
                    title="Copy result to clipboard"
                    @click=${(e: Event) => {
                      e.stopPropagation(); // Don't toggle expansion when clicking copy
                      const button = e.target as HTMLElement;
                      copyToClipboard(toolResponse.tool_result || "", button);
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div class="tool-call-section-content">
                  <div class="tool-call-result">
                    ${toolResponse.tool_result.includes("\n")
                      ? html`<pre><code>${toolResponse.tool_result}</code></pre>`
                      : toolResponse.tool_result}
                  </div>
                </div>
              </div>
            `
          : ""}
      </div>
    `;

    render(template, container);
  };

  // Initial render
  renderComponent();

  return container;
}

/**
 * Update a tool call card with response data
 * @param toolCard The tool card element to update
 * @param toolMessage The tool response message
 */
export function updateToolCallCard(
  toolCard: HTMLElement,
  toolMessage: TimelineMessage
): void {
  if (!toolCard) return;

  // Find the original tool call data to reconstruct the card
  const toolName = toolCard.querySelector(".tool-call-name")?.textContent || "";
  const inputPreview =
    toolCard.querySelector(".tool-call-input-preview")?.textContent || "";

  // Extract the original input from the expanded view
  let originalInput = "";
  const inputEl = toolCard.querySelector(".tool-call-input");
  if (inputEl) {
    originalInput = inputEl.textContent || "";
  }

  // Create a minimal ToolCall object from the existing data
  const toolCall: Partial<ToolCall> = {
    name: toolName,
    // Try to reconstruct the original input if possible
    input: originalInput,
  };

  // Replace the existing card with a new one
  const newCard = createToolCallCard(
    toolCall as ToolCall,
    toolMessage,
    toolCard.id
  );

  // Preserve the collapse state
  if (!toolCard.classList.contains("collapsed")) {
    newCard.classList.remove("collapsed");
  }

  // Replace the old card with the new one
  if (toolCard.parentNode) {
    toolCard.parentNode.replaceChild(newCard, toolCard);
  }
}
