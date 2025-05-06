import { css, html, LitElement } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property } from "lit/decorators.js";
import { ToolCall } from "../types";
import { marked } from "marked";

// Safely renders markdown with fallback to plain text on failure
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

@customElement("sketch-tool-card-knowledge-base")
export class SketchToolCardKnowledgeBase extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .summary-text {
      font-style: italic;
    }
    .knowledge-content {
      background: rgb(246, 248, 250);
      border-radius: 6px;
      padding: 12px;
      margin-top: 10px;
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #e1e4e8;
    }
    .topic-label {
      font-weight: bold;
      color: #24292e;
    }
    .icon {
      margin-right: 6px;
    }
  `;

  render() {
    const inputData = JSON.parse(this.toolCall?.input || "{}");
    const topic = inputData.topic || "unknown";
    const resultText = this.toolCall?.result_message?.tool_result || "";
    
    return html`
      <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
        <span slot="summary" class="summary-text">
          <span class="icon">📚</span> Knowledge: ${topic}
        </span>
        <div slot="input">
          <div>
            <span class="topic-label">Topic:</span> ${topic}
          </div>
        </div>
        ${this.toolCall?.result_message?.tool_result
          ? html`<div slot="result">
              <div class="knowledge-content">
                ${unsafeHTML(renderMarkdown(resultText))}
              </div>
            </div>`
          : ""}
      </sketch-tool-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-knowledge-base": SketchToolCardKnowledgeBase;
  }
}
