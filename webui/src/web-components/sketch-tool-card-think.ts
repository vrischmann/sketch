import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import { ToolCall } from "../types";

@customElement("sketch-tool-card-think")
export class SketchToolCardThink extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .thought-bubble {
      overflow-x: auto;
      margin-bottom: 3px;
      font-family: monospace;
      padding: 3px 5px;
      background: rgb(236, 236, 236);
      border-radius: 6px;
      user-select: text;
      cursor: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      font-size: 13px;
      line-height: 1.3;
    }
    .summary-text {
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: monospace;
    }
  `;

  render() {
    return html`
      <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
        <span slot="summary" class="summary-text">
          ${JSON.parse(this.toolCall?.input)?.thoughts?.split("\n")[0]}
        </span>
        <div slot="input" class="thought-bubble">
          <div class="markdown-content">
            ${unsafeHTML(
              renderMarkdown(JSON.parse(this.toolCall?.input)?.thoughts),
            )}
          </div>
        </div>
      </sketch-tool-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-think": SketchToolCardThink;
  }
}

function renderMarkdown(markdownContent: string): string {
  try {
    return marked.parse(markdownContent, {
      gfm: true,
      breaks: true,
      async: false,
    }) as string;
  } catch (error) {
    console.error("Error rendering markdown:", error);
    return markdownContent;
  }
}
