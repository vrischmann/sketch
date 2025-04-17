/**
 * MessageRenderer - Class to handle rendering of timeline messages
 */

import { TimelineMessage, ToolCall } from "./types";
import { escapeHTML, formatNumber, generateColorFromId } from "./utils";
import { renderMarkdown, processRenderedMarkdown } from "./markdown/renderer";
import { createToolCallCard, updateToolCallCard } from "./toolcalls";
import { createCommitsContainer } from "./commits";
import { createCopyButton } from "./copybutton";
import { getIconText } from "./icons";
import { addCollapsibleFunctionality } from "./components/collapsible";
import { checkShouldScroll, scrollToBottom } from "./scroll";

export class MessageRenderer {
  // Map to store references to agent message DOM elements by tool call ID
  private toolCallIdToMessageElement: Map<
    string,
    {
      messageEl: HTMLElement;
      toolCallContainer: HTMLElement | null;
      toolCardId: string;
    }
  > = new Map();

  // State tracking variables
  private isFirstLoad: boolean = true;
  private shouldScrollToBottom: boolean = true;
  private currentFetchStartIndex: number = 0;

  constructor() {}

  /**
   * Initialize the renderer with state from the timeline manager
   */
  public initialize(isFirstLoad: boolean, currentFetchStartIndex: number) {
    this.isFirstLoad = isFirstLoad;
    this.currentFetchStartIndex = currentFetchStartIndex;
  }

  /**
   * Renders the timeline with messages
   * @param messages The messages to render
   * @param clearExisting Whether to clear existing content before rendering
   */
  public renderTimeline(
    messages: TimelineMessage[],
    clearExisting: boolean = false,
  ): void {
    const timeline = document.getElementById("timeline");
    if (!timeline) return;

    // We'll keep the isFirstLoad value for this render cycle,
    // but will set it to false afterwards in scrollToBottom

    if (clearExisting) {
      timeline.innerHTML = ""; // Clear existing content only if this is the first load
      // Clear our map of tool call references
      this.toolCallIdToMessageElement.clear();
    }

    if (!messages || messages.length === 0) {
      if (clearExisting) {
        timeline.innerHTML = "<p>No messages available.</p>";
        timeline.classList.add("empty");
      }
      return;
    }

    // Remove empty class when there are messages
    timeline.classList.remove("empty");

    // Keep track of conversation groups to properly indent
    interface ConversationGroup {
      color: string;
      level: number;
    }

    const conversationGroups: Record<string, ConversationGroup> = {};

    // Use the currentFetchStartIndex as the base index for these messages
    const startIndex = this.currentFetchStartIndex;
    // Group tool messages with their parent agent messages
    const organizedMessages: (TimelineMessage & {
      toolResponses?: TimelineMessage[];
    })[] = [];
    const toolMessagesByCallId: Record<string, TimelineMessage> = {};

    // First, process tool messages - check if any can update existing UI elements
    const processedToolMessages = new Set<string>();

    messages.forEach((message) => {
      // If this is a tool message with a tool_call_id
      if (message.type === "tool" && message.tool_call_id) {
        // Try to find an existing agent message that's waiting for this tool response
        const toolCallRef = this.toolCallIdToMessageElement.get(
          message.tool_call_id,
        );

        if (toolCallRef) {
          // Found an existing agent message that needs updating
          this.updateToolCallInAgentMessage(message, toolCallRef);
          processedToolMessages.add(message.tool_call_id);
        } else {
          // No existing agent message found, we'll include this in normal rendering
          toolMessagesByCallId[message.tool_call_id] = message;
        }
      }
    });

    // Then, process messages and organize them
    messages.forEach((message, localIndex) => {
      const _index = startIndex + localIndex;
      if (!message) return; // Skip if message is null/undefined

      // If it's a tool message and we're going to inline it with its parent agent message,
      // we'll skip rendering it here - it will be included with the agent message
      if (message.type === "tool" && message.tool_call_id) {
        // Skip if we've already processed this tool message (updated an existing agent message)
        if (processedToolMessages.has(message.tool_call_id)) {
          return;
        }

        // Skip if this tool message will be included with a new agent message
        if (toolMessagesByCallId[message.tool_call_id]) {
          return;
        }
      }

      // For agent messages with tool calls, attach their tool responses
      if (
        message.type === "agent" &&
        message.tool_calls &&
        message.tool_calls.length > 0
      ) {
        const toolResponses: TimelineMessage[] = [];

        // Look up tool responses for each tool call
        message.tool_calls.forEach((toolCall) => {
          if (
            toolCall.tool_call_id &&
            toolMessagesByCallId[toolCall.tool_call_id]
          ) {
            toolResponses.push(toolMessagesByCallId[toolCall.tool_call_id]);
          }
        });

        if (toolResponses.length > 0) {
          message = { ...message, toolResponses };
        }
      }

      organizedMessages.push(message);
    });

    let lastMessage:TimelineMessage|undefined;
    if (messages && messages.length > 0 && startIndex > 0) {
      lastMessage = messages[startIndex-1];
    }

    // Loop through organized messages and create timeline items
    organizedMessages.forEach((message, localIndex) => {
      const _index = startIndex + localIndex;
      if (!message) return; // Skip if message is null/undefined

      if (localIndex > 0) {
        lastMessage = organizedMessages.at(localIndex-1);
      }
      // Determine if this is a subconversation
      const hasParent = !!message.parent_conversation_id;
      const conversationId = message.conversation_id || "";
      const _parentId = message.parent_conversation_id || "";

      // Track the conversation group
      if (conversationId && !conversationGroups[conversationId]) {
        conversationGroups[conversationId] = {
          color: generateColorFromId(conversationId),
          level: hasParent ? 1 : 0, // Level 0 for main conversation, 1+ for nested
        };
      }

      // Get the level and color for this message
      const group = conversationGroups[conversationId] || {
        level: 0,
        color: "#888888",
      };

      const messageEl = document.createElement("div");
      messageEl.className = `message ${message.type || "unknown"} ${message.end_of_turn ? "end-of-turn" : ""}`;

      // Add indentation class for subconversations
      if (hasParent) {
        messageEl.classList.add("subconversation");
        messageEl.style.marginLeft = `${group.level * 40}px`;

        // Add a colored left border to indicate the subconversation
        messageEl.style.borderLeft = `4px solid ${group.color}`;
      }

      // newMsgType indicates when to create a new icon and message
      // type header. This is a primitive form of message coalescing,
      // but it does reduce the amount of redundant information in
      // the UI.
      const newMsgType = !lastMessage || 
        (message.type == 'user' && lastMessage.type != 'user') ||
        (message.type != 'user' && lastMessage.type == 'user');

      if (newMsgType) {
        // Create message icon
        const iconEl = document.createElement("div");
        iconEl.className = "message-icon";
        iconEl.textContent = getIconText(message.type);
        messageEl.appendChild(iconEl);
      }

      // Create message content container
      const contentEl = document.createElement("div");
      contentEl.className = "message-content";

      // Create message header
      const headerEl = document.createElement("div");
      headerEl.className = "message-header";

      if (newMsgType) {
        const typeEl = document.createElement("span");
        typeEl.className = "message-type";
        typeEl.textContent = this.getTypeName(message.type);
        headerEl.appendChild(typeEl);
      }

      // Add timestamp and usage info combined for agent messages at the top
      if (message.timestamp) {
        const timestampEl = document.createElement("span");
        timestampEl.className = "message-timestamp";
        timestampEl.textContent = this.formatTimestamp(message.timestamp);

        // Add elapsed time if available
        if (message.elapsed) {
          timestampEl.textContent += ` (${(message.elapsed / 1e9).toFixed(2)}s)`;
        }

        // Add turn duration for end-of-turn messages
        if (message.turnDuration && message.end_of_turn) {
          timestampEl.textContent += ` [Turn: ${(message.turnDuration / 1e9).toFixed(2)}s]`;
        }

        // Add usage info inline for agent messages
        if (
          message.type === "agent" &&
          message.usage &&
          (message.usage.input_tokens > 0 ||
            message.usage.output_tokens > 0 ||
            message.usage.cost_usd > 0)
        ) {
          try {
            // Safe get all values
            const inputTokens = formatNumber(
              message.usage.input_tokens ?? 0,
            );
            const cacheInput = message.usage.cache_read_input_tokens ?? 0;
            const outputTokens = formatNumber(
              message.usage.output_tokens ?? 0,
            );
            const messageCost = this.formatCurrency(
              message.usage.cost_usd ?? 0,
              "$0.0000", // Default format for message costs
              true, // Use 4 decimal places for message-level costs
            );

            timestampEl.textContent += ` | In: ${inputTokens}`;
            if (cacheInput > 0) {
              timestampEl.textContent += ` [Cache: ${formatNumber(cacheInput)}]`;
            }
            timestampEl.textContent += ` Out: ${outputTokens} (${messageCost})`;
          } catch (e) {
            console.error("Error adding usage info to timestamp:", e);
          }
        }

        headerEl.appendChild(timestampEl);
      }

      contentEl.appendChild(headerEl);

      // Add message content
      if (message.content) {
        const containerEl = document.createElement("div");
        containerEl.className = "message-text-container";

        const textEl = document.createElement("div");
        textEl.className = "message-text markdown-content";
        
        // Render markdown content
        // Handle the Promise returned by renderMarkdown
        renderMarkdown(message.content).then(html => {
          textEl.innerHTML = html;
          processRenderedMarkdown(textEl);
        });

        // Add copy button
        const { container: copyButtonContainer, button: copyButton } = createCopyButton(message.content);
        containerEl.appendChild(copyButtonContainer);
        containerEl.appendChild(textEl);

        // Add collapse/expand for long content
        addCollapsibleFunctionality(message, textEl, containerEl, contentEl);
      }

      // If the message has tool calls, show them in an ultra-compact row of boxes
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCallsContainer = document.createElement("div");
        toolCallsContainer.className = "tool-calls-container";

        // Create a header row with tool count
        const toolCallsHeaderRow = document.createElement("div");
        toolCallsHeaderRow.className = "tool-calls-header";
        // No header text - empty header
        toolCallsContainer.appendChild(toolCallsHeaderRow);

        // Create a container for the tool call cards
        const toolCallsCardContainer = document.createElement("div");
        toolCallsCardContainer.className = "tool-call-cards-container";

        // Add each tool call as a card with response or spinner
        message.tool_calls.forEach((toolCall: ToolCall, _index: number) => {
          // Create a unique ID for this tool card
          const toolCardId = `tool-card-${toolCall.tool_call_id || Math.random().toString(36).substring(2, 11)}`;
          
          // Find the matching tool response if it exists
          const toolResponse = message.toolResponses?.find(
            (resp) => resp.tool_call_id === toolCall.tool_call_id,
          );
          
          // Use the extracted utility function to create the tool card
          const toolCard = createToolCallCard(toolCall, toolResponse, toolCardId);

          // Store reference to this element if it has a tool_call_id
          if (toolCall.tool_call_id) {
            this.toolCallIdToMessageElement.set(toolCall.tool_call_id, {
              messageEl,
              toolCallContainer: toolCallsCardContainer,
              toolCardId,
            });
          }

          // Add the card to the container
          toolCallsCardContainer.appendChild(toolCard);
        });

        toolCallsContainer.appendChild(toolCallsCardContainer);
        contentEl.appendChild(toolCallsContainer);
      }
      // If message is a commit message, display commits
      if (
        message.type === "commit" &&
        message.commits &&
        message.commits.length > 0
      ) {
        // Use the extracted utility function to create the commits container
        const commitsContainer = createCommitsContainer(
          message.commits,
          (commitHash) => {
            // This will need to be handled by the TimelineManager
            const event = new CustomEvent('showCommitDiff', {
              detail: { commitHash }
            });
            document.dispatchEvent(event);
          }
        );
        contentEl.appendChild(commitsContainer);
      }

      // Tool messages are now handled inline with agent messages
      // If we still see a tool message here, it means it's not associated with an agent message
      // (this could be legacy data or a special case)
      if (message.type === "tool") {
        const toolDetailsEl = document.createElement("div");
        toolDetailsEl.className = "tool-details standalone";

        // Get tool input and result for display
        let inputText = "";
        try {
          if (message.input) {
            const parsedInput = JSON.parse(message.input);
            // Format input compactly for simple inputs
            inputText = JSON.stringify(parsedInput);
          }
        } catch (e) {
          // Not valid JSON, use as-is
          inputText = message.input || "";
        }

        const resultText = message.tool_result || "";
        const statusEmoji = message.tool_error ? "❌" : "✅";
        const toolName = message.tool_name || "Unknown";

        // Determine if we can use super compact display (e.g., for bash command results)
        // Use compact display for short inputs/outputs without newlines
        const isSimpleCommand =
          toolName === "bash" &&
          inputText.length < 50 &&
          resultText.length < 200 &&
          !resultText.includes("\n");
        const isCompact =
          inputText.length < 50 &&
          resultText.length < 100 &&
          !resultText.includes("\n");

        if (isSimpleCommand) {
          // SUPER COMPACT VIEW FOR BASH: Display everything on a single line
          const toolLineEl = document.createElement("div");
          toolLineEl.className = "tool-compact-line";

          // Create the compact bash display in format: "✅ bash({command}) → result"
          try {
            const parsed = JSON.parse(inputText);
            const cmd = parsed.command || "";
            toolLineEl.innerHTML = `${statusEmoji} <strong>${toolName}</strong>({"command":"${cmd}"}) → <span class="tool-result-inline">${resultText}</span>`;
          } catch {
            toolLineEl.innerHTML = `${statusEmoji} <strong>${toolName}</strong>(${inputText}) → <span class="tool-result-inline">${resultText}</span>`;
          }

          // Add copy button for result
          const copyBtn = document.createElement("button");
          copyBtn.className = "copy-inline-button";
          copyBtn.textContent = "Copy";
          copyBtn.title = "Copy result to clipboard";

          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard
              .writeText(resultText)
              .then(() => {
                copyBtn.textContent = "Copied!";
                setTimeout(() => {
                  copyBtn.textContent = "Copy";
                }, 2000);
              })
              .catch((_err) => {
                copyBtn.textContent = "Failed";
                setTimeout(() => {
                  copyBtn.textContent = "Copy";
                }, 2000);
              });
          });

          toolLineEl.appendChild(copyBtn);
          toolDetailsEl.appendChild(toolLineEl);
        } else if (isCompact && !isSimpleCommand) {
          // COMPACT VIEW: Display everything on one or two lines for other tool types
          const toolLineEl = document.createElement("div");
          toolLineEl.className = "tool-compact-line";

          // Create the compact display in format: "✅ tool_name(input) → result"
          let compactDisplay = `${statusEmoji} <strong>${toolName}</strong>(${inputText})`;

          if (resultText) {
            compactDisplay += ` → <span class="tool-result-inline">${resultText}</span>`;
          }

          toolLineEl.innerHTML = compactDisplay;

          // Add copy button for result
          const copyBtn = document.createElement("button");
          copyBtn.className = "copy-inline-button";
          copyBtn.textContent = "Copy";
          copyBtn.title = "Copy result to clipboard";

          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard
              .writeText(resultText)
              .then(() => {
                copyBtn.textContent = "Copied!";
                setTimeout(() => {
                  copyBtn.textContent = "Copy";
                }, 2000);
              })
              .catch((_err) => {
                copyBtn.textContent = "Failed";
                setTimeout(() => {
                  copyBtn.textContent = "Copy";
                }, 2000);
              });
          });

          toolLineEl.appendChild(copyBtn);
          toolDetailsEl.appendChild(toolLineEl);
        } else {
          // EXPANDED VIEW: For longer inputs/results that need more space
          // Tool name header
          const toolNameEl = document.createElement("div");
          toolNameEl.className = "tool-name";
          toolNameEl.innerHTML = `${statusEmoji} <strong>${toolName}</strong>`;
          toolDetailsEl.appendChild(toolNameEl);

          // Show input (simplified)
          if (message.input) {
            const inputContainer = document.createElement("div");
            inputContainer.className = "tool-input-container compact";

            const inputEl = document.createElement("pre");
            inputEl.className = "tool-input compact";
            inputEl.textContent = inputText;
            inputContainer.appendChild(inputEl);
            toolDetailsEl.appendChild(inputContainer);
          }

          // Show result (simplified)
          if (resultText) {
            const resultContainer = document.createElement("div");
            resultContainer.className = "tool-result-container compact";

            const resultEl = document.createElement("pre");
            resultEl.className = "tool-result compact";
            resultEl.textContent = resultText;
            resultContainer.appendChild(resultEl);

            // Add collapse/expand for longer results
            if (resultText.length > 100) {
              resultEl.classList.add("collapsed");

              const toggleButton = document.createElement("button");
              toggleButton.className = "collapsible";
              toggleButton.textContent = "Show more...";
              toggleButton.addEventListener("click", () => {
                resultEl.classList.toggle("collapsed");
                toggleButton.textContent = resultEl.classList.contains(
                  "collapsed",
                )
                  ? "Show more..."
                  : "Show less";
              });

              toolDetailsEl.appendChild(resultContainer);
              toolDetailsEl.appendChild(toggleButton);
            } else {
              toolDetailsEl.appendChild(resultContainer);
            }
          }
        }

        contentEl.appendChild(toolDetailsEl);
      }

      // Add usage info if available with robust null handling - only for non-agent messages
      if (
        message.type !== "agent" && // Skip for agent messages as we've already added usage info at the top
        message.usage &&
        (message.usage.input_tokens > 0 ||
          message.usage.output_tokens > 0 ||
          message.usage.cost_usd > 0)
      ) {
        try {
          const usageEl = document.createElement("div");
          usageEl.className = "usage-info";

          // Safe get all values
          const inputTokens = formatNumber(
            message.usage.input_tokens ?? 0,
          );
          const cacheInput = message.usage.cache_read_input_tokens ?? 0;
          const outputTokens = formatNumber(
            message.usage.output_tokens ?? 0,
          );
          const messageCost = this.formatCurrency(
            message.usage.cost_usd ?? 0,
            "$0.0000", // Default format for message costs
            true, // Use 4 decimal places for message-level costs
          );

          // Create usage info display
          usageEl.innerHTML = `
            <span title="Input tokens">In: ${inputTokens}</span>
            ${cacheInput > 0 ? `<span title="Cache tokens">[Cache: ${formatNumber(cacheInput)}]</span>` : ""}
            <span title="Output tokens">Out: ${outputTokens}</span>
            <span title="Message cost">(${messageCost})</span>
          `;

          contentEl.appendChild(usageEl);
        } catch (e) {
          console.error("Error rendering usage info:", e);
        }
      }

      messageEl.appendChild(contentEl);
      timeline.appendChild(messageEl);
    });

    // Scroll to bottom of the timeline if needed
    this.scrollToBottom();
  }

  /**
   * Check if we should scroll to the bottom
   */
  private checkShouldScroll(): boolean {
    return checkShouldScroll(this.isFirstLoad);
  }

  /**
   * Scroll to the bottom of the timeline
   */
  private scrollToBottom(): void {
    scrollToBottom(this.shouldScrollToBottom);

    // After first load, we'll only auto-scroll if user is already near the bottom
    this.isFirstLoad = false;
  }

  /**
   * Get readable name for message type
   */
  private getTypeName(type: string | null | undefined): string {
    switch (type) {
      case "user":
        return "User";
      case "agent":
        return "Agent";
      case "tool":
        return "Tool Use";
      case "error":
        return "Error";
      default:
        return (
          (type || "Unknown").charAt(0).toUpperCase() +
          (type || "unknown").slice(1)
        );
    }
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(
    timestamp: string | number | Date | null | undefined,
    defaultValue: string = "",
  ): string {
    if (!timestamp) return defaultValue;
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return defaultValue;

      // Format: Mar 13, 2025 09:53:25 AM
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Format currency values
   */
  private formatCurrency(
    num: number | string | null | undefined,
    defaultValue: string = "$0.00",
    isMessageLevel: boolean = false,
  ): string {
    if (num === undefined || num === null) return defaultValue;
    try {
      // Use 4 decimal places for message-level costs, 2 for totals
      const decimalPlaces = isMessageLevel ? 4 : 2;
      return `$${parseFloat(String(num)).toFixed(decimalPlaces)}`;
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Update a tool call in an agent message with the response
   */
  private updateToolCallInAgentMessage(
    toolMessage: TimelineMessage,
    toolCallRef: {
      messageEl: HTMLElement;
      toolCallContainer: HTMLElement | null;
      toolCardId: string;
    },
  ): void {
    const { messageEl, toolCardId } = toolCallRef;

    // Find the tool card element
    const toolCard = messageEl.querySelector(`#${toolCardId}`) as HTMLElement;
    if (!toolCard) return;

    // Use the extracted utility function to update the tool card
    updateToolCallCard(toolCard, toolMessage);
  }

  /**
   * Get the tool call id to message element map
   * Used by the TimelineManager to access the map
   */
  public getToolCallIdToMessageElement(): Map<
    string,
    {
      messageEl: HTMLElement;
      toolCallContainer: HTMLElement | null;
      toolCardId: string;
    }
  > {
    return this.toolCallIdToMessageElement;
  }

  /**
   * Set the tool call id to message element map
   * Used by the TimelineManager to update the map
   */
  public setToolCallIdToMessageElement(
    map: Map<
      string,
      {
        messageEl: HTMLElement;
        toolCallContainer: HTMLElement | null;
        toolCardId: string;
      }
    >
  ): void {
    this.toolCallIdToMessageElement = map;
  }
}
