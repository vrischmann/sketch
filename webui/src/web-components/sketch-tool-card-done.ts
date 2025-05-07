import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";


@customElement("sketch-tool-card-done")
export class SketchToolCardDone extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  render() {
    const doneInput = JSON.parse(this.toolCall.input);
    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span slot="summary" class="summary-text"></span>
      <div slot="result">
        ${Object.keys(doneInput.checklist_items).map((key) => {
      const item = doneInput.checklist_items[key];
      let statusIcon = "⛔";
      if (item.status == "yes") {
        statusIcon = "👍";
      } else if (item.status == "not applicable") {
        statusIcon = "🤷‍♂️";
      }
      return html`<div>
            <span>${statusIcon}</span> ${key}:${item.status}
          </div>`;
    })}
      </div>
    </sketch-tool-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-done": SketchToolCardDone;
  }
}
