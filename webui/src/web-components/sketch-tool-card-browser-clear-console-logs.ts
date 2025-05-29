import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-browser-clear-console-logs")
export class SketchToolCardBrowserClearConsoleLogs extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  static styles = css`
    .summary-text {
      font-family: monospace;
      color: #444;
      word-break: break-all;
    }
  `;

  render() {
    return html`
      <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
        <span slot="summary" class="summary-text"> 🧹 Clear console logs </span>
        <div slot="input">
          <div>Clear all console logs</div>
        </div>
        <div slot="result">
          ${this.toolCall?.result_message?.tool_result
            ? html`<pre>${this.toolCall.result_message.tool_result}</pre>`
            : ""}
        </div>
      </sketch-tool-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-browser-clear-console-logs": SketchToolCardBrowserClearConsoleLogs;
  }
}
