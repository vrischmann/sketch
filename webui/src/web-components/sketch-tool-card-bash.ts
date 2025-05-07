import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

// Common styles shared across all tool cards
export const commonStyles = css`
  pre {
    background: rgb(236, 236, 236);
    color: black;
    padding: 0.5em;
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
  }
  .summary-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    font-family: monospace;
  }
`;

@customElement("sketch-tool-card-bash")
export class SketchToolCardBash extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = [
    commonStyles,
    css`
      .input {
        display: flex;
        width: 100%;
        flex-direction: column;
      }
      .input pre {
        width: 100%;
        margin-bottom: 0;
        border-radius: 4px 4px 0 0;
        box-sizing: border-box;
      }
      .result pre {
        margin-top: 0;
        color: #555;
        border-radius: 0 0 4px 4px;
        width: 100%;
        box-sizing: border-box;
      }
      .result pre.scrollable-on-hover {
        max-height: 300px;
        overflow-y: auto;
      }
      .tool-call-result-container {
        width: 100%;
        position: relative;
      }
      .background-badge {
        display: inline-block;
        background-color: #6200ea;
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 8px;
        vertical-align: middle;
      }
      .command-wrapper {
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  render() {
    const inputData = JSON.parse(this.toolCall?.input || "{}");
    const isBackground = inputData?.background === true;
    const backgroundIcon = isBackground ? "🔄 " : "";

    return html` <sketch-tool-card
      .open=${this.open}
      .toolCall=${this.toolCall}
    >
      <span slot="summary" class="summary-text">
        <div class="command-wrapper">
          ${backgroundIcon}${inputData?.command}
        </div>
      </span>
      <div slot="input" class="input">
        <div class="tool-call-result-container">
          <pre>${backgroundIcon}${inputData?.command}</pre>
        </div>
      </div>
      ${this.toolCall?.result_message?.tool_result
        ? html`<div slot="result" class="result">
            <div class="tool-call-result-container">
              <pre class="tool-call-result">
${this.toolCall?.result_message.tool_result}</pre
              >
            </div>
          </div>`
        : ""}
    </sketch-tool-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-bash": SketchToolCardBash;
  }
}
