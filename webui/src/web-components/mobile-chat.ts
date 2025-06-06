import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { AgentMessage } from "../types";
import { createRef, ref } from "lit/directives/ref.js";

@customElement("mobile-chat")
export class MobileChat extends LitElement {
  @property({ type: Array })
  messages: AgentMessage[] = [];

  @property({ type: Boolean })
  isThinking = false;

  private scrollContainer = createRef<HTMLDivElement>();

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }

    .chat-container {
      height: 100%;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 85%;
      word-wrap: break-word;
    }

    .message.user {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message.assistant {
      align-self: flex-start;
      align-items: flex-start;
    }

    .message-bubble {
      padding: 8px 12px;
      border-radius: 18px;
      font-size: 16px;
      line-height: 1.4;
    }

    .message.user .message-bubble {
      background-color: #007bff;
      color: white;
      border-bottom-right-radius: 6px;
    }

    .message.assistant .message-bubble {
      background-color: #f1f3f4;
      color: #333;
      border-bottom-left-radius: 6px;
    }

    .thinking-message {
      align-self: flex-start;
      align-items: flex-start;
      max-width: 85%;
    }

    .thinking-bubble {
      background-color: #f1f3f4;
      padding: 16px;
      border-radius: 18px;
      border-bottom-left-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .thinking-text {
      color: #6c757d;
      font-style: italic;
    }

    .thinking-dots {
      display: flex;
      gap: 3px;
    }

    .thinking-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #6c757d;
      animation: thinking 1.4s ease-in-out infinite both;
    }

    .thinking-dot:nth-child(1) {
      animation-delay: -0.32s;
    }
    .thinking-dot:nth-child(2) {
      animation-delay: -0.16s;
    }
    .thinking-dot:nth-child(3) {
      animation-delay: 0;
    }

    @keyframes thinking {
      0%,
      80%,
      100% {
        transform: scale(0.8);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6c757d;
      font-style: italic;
      text-align: center;
      padding: 32px;
    }
  `;

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    if (
      changedProperties.has("messages") ||
      changedProperties.has("isThinking")
    ) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom() {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (this.scrollContainer.value) {
        this.scrollContainer.value.scrollTop =
          this.scrollContainer.value.scrollHeight;
      }
    });
  }

  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  private getMessageRole(message: AgentMessage): string {
    if (message.type === "user") {
      return "user";
    }
    return "assistant";
  }

  private getMessageText(message: AgentMessage): string {
    return message.content || "";
  }

  private shouldShowMessage(message: AgentMessage): boolean {
    // Show user, agent, and error messages with content
    return (
      (message.type === "user" ||
        message.type === "agent" ||
        message.type === "error") &&
      message.content &&
      message.content.trim().length > 0
    );
  }

  render() {
    const displayMessages = this.messages.filter((msg) =>
      this.shouldShowMessage(msg),
    );

    return html`
      <div class="chat-container" ${ref(this.scrollContainer)}>
        ${displayMessages.length === 0
          ? html`
              <div class="empty-state">Start a conversation with Sketch...</div>
            `
          : displayMessages.map((message) => {
              const role = this.getMessageRole(message);
              const text = this.getMessageText(message);
              const timestamp = message.timestamp;

              return html`
                <div class="message ${role}">
                  <div class="message-bubble">${text}</div>
                </div>
              `;
            })}
        ${this.isThinking
          ? html`
              <div class="thinking-message">
                <div class="thinking-bubble">
                  <span class="thinking-text">Sketch is thinking</span>
                  <div class="thinking-dots">
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                  </div>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}
