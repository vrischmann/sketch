import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-generic")
export class SketchToolCardGeneric extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  render() {
    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span slot="summary" class="summary-text">${this.toolCall?.input}</span>
      <div slot="input">
        Input:
        <pre>${this.toolCall?.input}</pre>
      </div>
      <div slot="result">
        Result:
        ${this.toolCall?.result_message?.tool_result
          ? html`<pre>${this.toolCall?.result_message.tool_result}</pre>`
          : ""}
      </div>
    </sketch-tool-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-generic": SketchToolCardGeneric;
  }
}
