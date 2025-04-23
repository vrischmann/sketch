import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";

@customElement("sketch-chat-input")
export class SketchChatInput extends LitElement {
  @property()
  content: string = "";

  // See https://lit.dev/docs/components/styles/ for how lit-element handles CSS.
  // Note that these styles only apply to the scope of this web component's
  // shadow DOM node, so they won't leak out or collide with CSS declared in
  // other components or the containing web page (...unless you want it to do that).
  static styles = css`
    /* Chat styles - exactly matching timeline.css */
    .chat-container {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: #f0f0f0;
      padding: 15px;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      min-height: 40px; /* Ensure minimum height */
    }

    .chat-input-wrapper {
      display: flex;
      max-width: 1200px;
      margin: 0 auto;
      gap: 10px;
    }

    #chatInput {
      flex: 1;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      font-family: monospace;
      font-size: 12px;
      min-height: 40px;
      max-height: 300px;
      background: #f7f7f7;
      overflow-y: auto;
      box-sizing: border-box; /* Ensure padding is included in height calculation */
      line-height: 1.4; /* Consistent line height for better height calculation */
    }

    #sendChatButton {
      background-color: #2196f3;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 0 20px;
      cursor: pointer;
      font-weight: 600;
      align-self: center;
      height: 40px;
    }

    #sendChatButton:hover {
      background-color: #0d8bf2;
    }
  `;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
  }

  // See https://lit.dev/docs/components/lifecycle/
  disconnectedCallback() {
    super.disconnectedCallback();
  }

  sendChatMessage() {
    const event = new CustomEvent("send-chat", {
      detail: { message: this.content },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  adjustChatSpacing() {
    if (!this.chatInput) return;

    // Reset height to minimal value to correctly calculate scrollHeight
    this.chatInput.style.height = "auto";

    // Get the scroll height (content height)
    const scrollHeight = this.chatInput.scrollHeight;

    // Set the height to match content (up to max-height which is handled by CSS)
    this.chatInput.style.height = `${scrollHeight}px`;
  }

  _sendChatClicked() {
    this.sendChatMessage();
    this.chatInput.focus(); // Refocus the input after sending
    // Reset height after sending a message
    requestAnimationFrame(() => this.adjustChatSpacing());
  }

  _chatInputKeyDown(event: KeyboardEvent) {
    // Send message if Enter is pressed without Shift key
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault(); // Prevent default newline
      this.sendChatMessage();
    }
  }

  _chatInputChanged(event) {
    this.content = event.target.value;
    // Use requestAnimationFrame to ensure DOM updates have completed
    requestAnimationFrame(() => this.adjustChatSpacing());
  }

  @query("#chatInput")
  chatInput: HTMLTextAreaElement;

  protected firstUpdated(): void {
    if (this.chatInput) {
      this.chatInput.focus();
      // Initialize the input height
      this.adjustChatSpacing();
    }
  }

  render() {
    return html`
      <div class="chat-container">
        <div class="chat-input-wrapper">
          <textarea
            id="chatInput"
            placeholder="Type your message here and press Enter to send..."
            autofocus
            @keydown="${this._chatInputKeyDown}"
            @input="${this._chatInputChanged}"
            .value=${this.content || ""}
          ></textarea>
          <button @click="${this._sendChatClicked}" id="sendChatButton">
            Send
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-chat-input": SketchChatInput;
  }
}
