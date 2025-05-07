import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-title")
export class SketchToolCardTitle extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .summary-text {
      font-style: italic;
    }
    pre {
      display: inline;
      font-family: monospace;
      background: rgb(236, 236, 236);
      padding: 2px 4px;
      border-radius: 2px;
      margin: 0;
    }
  `;

  render() {
    const inputData = JSON.parse(this.toolCall?.input || "{}");
    return html`
      <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
        <span slot="summary" class="summary-text">
          Title: "${inputData.title}" | Branch: sketch/${inputData.branch_name}
        </span>
        <div slot="input">
          <div>Set title to: <b>${inputData.title}</b></div>
          <div>Set branch to: <code>sketch/${inputData.branch_name}</code></div>
        </div>
      </sketch-tool-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-title": SketchToolCardTitle;
  }
}
