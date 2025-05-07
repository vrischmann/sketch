import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card")
export class SketchToolCard extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;
  @state() detailsVisible: boolean = false;

  static styles = css`
    .tool-call {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .tool-row {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px 6px 12px;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }
    .tool-row:hover {
      background-color: rgba(0, 0, 0, 0.02);
    }
    .tool-name {
      font-family: monospace;
      font-weight: 500;
      color: #444;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
      padding: 2px 6px;
      flex-shrink: 0;
      min-width: 45px;
      font-size: 12px;
      text-align: center;
      white-space: nowrap;
    }
    .tool-success {
      color: #5cb85c;
      font-size: 14px;
    }
    .tool-error {
      color: #6c757d;
      font-size: 14px;
    }
    .tool-pending {
      color: #f0ad4e;
      font-size: 14px;
    }
    .summary-text {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      flex-grow: 1;
      flex-shrink: 1;
      color: #444;
      font-family: monospace;
      font-size: 12px;
      padding: 0 4px;
      min-width: 50px;
      max-width: calc(100% - 250px);
      display: inline-block;
    }
    .tool-status {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
      flex-shrink: 0;
      min-width: 120px;
      justify-content: flex-end;
      padding-right: 8px;
    }
    .tool-call-status {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tool-call-status.spinner {
      animation: spin 1s infinite linear;
    }
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    .elapsed {
      font-size: 11px;
      color: #777;
      white-space: nowrap;
      min-width: 40px;
      text-align: right;
    }
    .tool-details {
      padding: 8px;
      background-color: rgba(0, 0, 0, 0.02);
      margin-top: 1px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      display: none;
      font-family: monospace;
      font-size: 12px;
      color: #333;
      border-radius: 0 0 4px 4px;
      max-width: 100%;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .tool-details.visible {
      display: block;
    }
    .cancel-button {
      cursor: pointer;
      color: white;
      background-color: #d9534f;
      border: none;
      border-radius: 3px;
      font-size: 11px;
      padding: 2px 6px;
      white-space: nowrap;
      min-width: 50px;
    }
    .cancel-button:hover {
      background-color: #c9302c;
    }
    .cancel-button[disabled] {
      background-color: #999;
      cursor: not-allowed;
    }
  `;

  _cancelToolCall = async (tool_call_id: string, button: HTMLButtonElement) => {
    button.innerText = "Cancelling";
    button.disabled = true;
    try {
      const response = await fetch("cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_call_id: tool_call_id,
          reason: "user requested cancellation",
        }),
      });
      if (response.ok) {
        button.parentElement.removeChild(button);
      } else {
        button.innerText = "Cancel";
      }
    } catch (e) {
      console.error("cancel", tool_call_id, e);
    }
  };

  _toggleDetails(e: Event) {
    e.stopPropagation();
    this.detailsVisible = !this.detailsVisible;
  }

  render() {
    // Status indicator based on result
    let statusIcon = html`<span class="tool-call-status spinner tool-pending"
      >⏳</span
    >`;
    if (this.toolCall?.result_message) {
      statusIcon = this.toolCall?.result_message.tool_error
        ? html`<span class="tool-call-status tool-error">🔔</span>`
        : html`<span class="tool-call-status tool-success">✓</span>`;
    }

    // Cancel button for pending operations
    const cancelButton = this.toolCall?.result_message
      ? ""
      : html`<button
          class="cancel-button"
          title="Cancel this operation"
          @click=${(e: Event) => {
            e.stopPropagation();
            this._cancelToolCall(
              this.toolCall?.tool_call_id,
              e.target as HTMLButtonElement,
            );
          }}
        >
          Cancel
        </button>`;

    // Elapsed time display
    const elapsed = this.toolCall?.result_message?.elapsed
      ? html`<span class="elapsed"
          >${(this.toolCall?.result_message?.elapsed / 1e9).toFixed(1)}s</span
        >`
      : html`<span class="elapsed"></span>`;

    // Initialize details visibility based on open property
    if (this.open && !this.detailsVisible) {
      this.detailsVisible = true;
    }

    return html`<div class="tool-call">
      <div class="tool-row" @click=${this._toggleDetails}>
        <span class="tool-name">${this.toolCall?.name}</span>
        <span class="summary-text"><slot name="summary"></slot></span>
        <div class="tool-status">${statusIcon} ${elapsed} ${cancelButton}</div>
      </div>
      <div class="tool-details ${this.detailsVisible ? "visible" : ""}">
        <slot name="input"></slot>
        <slot name="result"></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card": SketchToolCard;
  }
}
