import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-browser-scroll-into-view")
export class SketchToolCardBrowserScrollIntoView extends LitElement {
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

    .selector-input {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.05);
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      word-break: break-all;
    }
  `;

  render() {
    // Parse the input to get selector
    let selector = "";
    try {
      if (this.toolCall?.input) {
        const input = JSON.parse(this.toolCall.input);
        selector = input.selector || "";
      }
    } catch (e) {
      console.error("Error parsing scroll into view input:", e);
    }

    return html`
      <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
        <span slot="summary" class="summary-text"> 🔄 ${selector} </span>
        <div slot="input">
          <div>
            Scroll into view: <span class="selector-input">${selector}</span>
          </div>
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
    "sketch-tool-card-browser-scroll-into-view": SketchToolCardBrowserScrollIntoView;
  }
}
