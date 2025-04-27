import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("sketch-call-status")
export class SketchCallStatus extends LitElement {
  @property({ type: Number })
  llmCalls: number = 0;

  @property({ type: Array })
  toolCalls: string[] = [];

  static styles = css`
    .call-status-container {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 10px;
    }

    .indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      position: relative;
    }

    .llm-indicator {
      opacity: 0.5;
    }

    .llm-indicator.active {
      opacity: 1;
      color: #ffc107;
    }

    .tool-indicator {
      opacity: 0.5;
    }

    .tool-indicator.active {
      opacity: 1;
      color: #2196f3;
    }

    .count-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background-color: #f44336;
      color: white;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Icon styles */
    .icon {
      font-size: 20px;
    }
  `;

  constructor() {
    super();
  }

  render() {
    return html`
      <div class="call-status-container">
        <div
          class="indicator llm-indicator ${this.llmCalls > 0 ? "active" : ""}"
          title="${this.llmCalls > 0
            ? `${this.llmCalls} LLM ${this.llmCalls === 1 ? "call" : "calls"} in progress`
            : "No LLM calls in progress"}"
        >
          <span class="icon">💡</span>
          ${this.llmCalls >= 1
            ? html`<span class="count-badge">${this.llmCalls}</span>`
            : ""}
        </div>
        <div
          class="indicator tool-indicator ${this.toolCalls.length > 0
            ? "active"
            : ""}"
          title="${this.toolCalls.length > 0
            ? `${this.toolCalls.length} tool ${this.toolCalls.length === 1 ? "call" : "calls"} in progress: ${this.toolCalls.join(", ")}`
            : "No tool calls in progress"}"
        >
          <span class="icon">🔧</span>
          ${this.toolCalls.length >= 1
            ? html`<span class="count-badge">${this.toolCalls.length}</span>`
            : ""}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-call-status": SketchCallStatus;
  }
}
