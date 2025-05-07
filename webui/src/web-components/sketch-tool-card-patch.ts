import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-patch")
export class SketchToolCardPatch extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .summary-text {
      color: #555;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-radius: 3px;
    }
  `;

  render() {
    const patchInput = JSON.parse(this.toolCall?.input);
    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span slot="summary" class="summary-text">
        ${patchInput?.path}: ${patchInput.patches.length}
        edit${patchInput.patches.length > 1 ? "s" : ""}
      </span>
      <div slot="input">
        ${patchInput.patches.map((patch) => {
          return html`Patch operation: <b>${patch.operation}</b>
            <pre>${patch.newText}</pre>`;
        })}
      </div>
      <div slot="result">
        <pre>${this.toolCall?.result_message?.tool_result}</pre>
      </div>
    </sketch-tool-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-patch": SketchToolCardPatch;
  }
}
