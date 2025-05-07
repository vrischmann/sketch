import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-codereview")
export class SketchToolCardCodeReview extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  // Determine the status icon based on the content of the result message
  getStatusIcon(resultText: string): string {
    if (!resultText) return "";
    if (resultText === "OK") return "✔️";
    if (resultText.includes("# Errors")) return "⚠️";
    if (resultText.includes("# Info")) return "ℹ️";
    if (resultText.includes("uncommitted changes in repo")) return "🧹";
    if (resultText.includes("no new commits have been added")) return "🐣";
    if (resultText.includes("git repo is not clean")) return "🧼";
    return "❓";
  }

  render() {
    const resultText = this.toolCall?.result_message?.tool_result || "";
    const statusIcon = this.getStatusIcon(resultText);

    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span slot="summary" class="summary-text">${statusIcon}</span>
      <div slot="result"><pre>${resultText}</pre></div>
    </sketch-tool-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-codereview": SketchToolCardCodeReview;
  }
}
