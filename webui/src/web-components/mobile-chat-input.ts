import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";

@customElement("mobile-chat-input")
export class MobileChatInput extends LitElement {
  @property({ type: Boolean })
  disabled = false;

  @state()
  private inputValue = "";

  private textareaRef = createRef<HTMLTextAreaElement>();

  static styles = css`
    :host {
      display: block;
      background-color: #ffffff;
      border-top: 1px solid #e9ecef;
      padding: 12px 16px;
      /* Enhanced iOS safe area support */
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      padding-left: max(16px, env(safe-area-inset-left));
      padding-right: max(16px, env(safe-area-inset-right));
      /* Prevent iOS Safari from covering the input */
      position: relative;
      z-index: 1000;
    }

    .input-container {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      max-width: 100%;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
      min-width: 0;
    }

    textarea {
      width: 100%;
      min-height: 40px;
      max-height: 120px;
      padding: 12px 16px;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 16px;
      font-family: inherit;
      line-height: 1.4;
      resize: none;
      outline: none;
      background-color: #f8f9fa;
      transition:
        border-color 0.2s,
        background-color 0.2s;
      box-sizing: border-box;
    }

    textarea:focus {
      border-color: #007bff;
      background-color: #ffffff;
    }

    textarea:disabled {
      background-color: #e9ecef;
      color: #6c757d;
      cursor: not-allowed;
    }

    textarea::placeholder {
      color: #6c757d;
    }

    .send-button {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background-color: #007bff;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition:
        background-color 0.2s,
        transform 0.1s;
      outline: none;
    }

    .send-button:hover:not(:disabled) {
      background-color: #0056b3;
    }

    .send-button:active:not(:disabled) {
      transform: scale(0.95);
    }

    .send-button:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .send-icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    /* iOS specific adjustments */
    @supports (-webkit-touch-callout: none) {
      textarea {
        font-size: 16px; /* Prevent zoom on iOS */
      }
    }
  `;

  private handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    this.inputValue = target.value;
    this.adjustTextareaHeight();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  };

  private adjustTextareaHeight() {
    if (this.textareaRef.value) {
      const textarea = this.textareaRef.value;
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }

  private sendMessage = () => {
    const message = this.inputValue.trim();
    if (message && !this.disabled) {
      this.dispatchEvent(
        new CustomEvent("send-message", {
          detail: { message },
          bubbles: true,
          composed: true,
        }),
      );

      this.inputValue = "";
      if (this.textareaRef.value) {
        this.textareaRef.value.value = "";
        this.adjustTextareaHeight();
        this.textareaRef.value.focus();
      }
    }
  };

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    this.adjustTextareaHeight();
  }

  render() {
    const canSend = this.inputValue.trim().length > 0 && !this.disabled;

    return html`
      <div class="input-container">
        <div class="input-wrapper">
          <textarea
            ${ref(this.textareaRef)}
            .value=${this.inputValue}
            @input=${this.handleInput}
            @keydown=${this.handleKeyDown}
            placeholder="Message Sketch..."
            ?disabled=${this.disabled}
            rows="1"
          ></textarea>
        </div>

        <button
          class="send-button"
          @click=${this.sendMessage}
          ?disabled=${!canSend}
          title="Send message"
        >
          <svg class="send-icon" viewBox="0 0 24 24">
            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
          </svg>
        </button>
      </div>
    `;
  }
}
