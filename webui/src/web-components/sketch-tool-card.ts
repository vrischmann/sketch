import { css, html, LitElement } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property, state } from "lit/decorators.js";
import {
  ToolCall,
  MultipleChoiceOption,
  MultipleChoiceParams,
  State,
} from "../types";
import { marked, MarkedOptions, Renderer } from "marked";
import DOMPurify from "dompurify";

// Shared utility function for markdown rendering with DOMPurify sanitization
function renderMarkdown(markdownContent: string): string {
  try {
    // Parse markdown with default settings
    const htmlOutput = marked.parse(markdownContent, {
      gfm: true,
      breaks: true,
      async: false,
    }) as string;

    // Sanitize the output HTML with DOMPurify
    return DOMPurify.sanitize(htmlOutput, {
      // Allow common safe HTML elements
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "s",
        "code",
        "pre",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "a",
      ],
      ALLOWED_ATTR: [
        "href",
        "title",
        "target",
        "rel", // For links
        "class", // For basic styling
      ],
      // Keep content formatting
      KEEP_CONTENT: true,
    });
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to sanitized plain text if markdown parsing fails
    return DOMPurify.sanitize(markdownContent);
  }
}

// Common styles shared across all tool cards
const commonStyles = css`
  :host {
    display: block;
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
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
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    max-width: 100% !important;
    width: 100% !important;
    font-family: monospace;
    display: block;
  }
`;

@customElement("sketch-tool-card")
export class SketchToolCard extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;
  @state() detailsVisible: boolean = false;

  static styles = css`
    .tool-call {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .tool-row {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px 6px 12px;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
      flex-wrap: wrap;
    }
    .tool-row:hover {
      background-color: rgba(0, 0, 0, 0.02);
    }
    .tool-name {
      font-family: monospace;
      font-weight: 500;
      color: #444;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
      padding: 2px 6px;
      flex-shrink: 0;
      min-width: 45px;
      font-size: 12px;
      text-align: center;
      white-space: nowrap;
    }
    .tool-success {
      color: #5cb85c;
      font-size: 14px;
    }
    .tool-error {
      color: #6c757d;
      font-size: 14px;
    }
    .tool-pending {
      color: #f0ad4e;
      font-size: 14px;
    }
    .summary-text {
      white-space: normal;
      overflow-wrap: break-word;
      word-break: break-word;
      flex-grow: 1;
      flex-shrink: 1;
      color: #444;
      font-family: monospace;
      font-size: 12px;
      padding: 0 4px;
      min-width: 50px;
      max-width: calc(100% - 150px);
      display: inline-block;
    }
    .tool-status {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
      flex-shrink: 0;
      min-width: 120px;
      justify-content: flex-end;
      padding-right: 8px;
    }
    .tool-call-status {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tool-call-status.spinner {
      animation: spin 1s infinite linear;
    }
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    .elapsed {
      font-size: 11px;
      color: #777;
      white-space: nowrap;
      min-width: 40px;
      text-align: right;
    }
    .tool-details {
      padding: 8px;
      background-color: rgba(0, 0, 0, 0.02);
      margin-top: 1px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      display: none;
      font-family: monospace;
      font-size: 12px;
      color: #333;
      border-radius: 0 0 4px 4px;
      max-width: 100%;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .tool-details.visible {
      display: block;
    }
    .cancel-button {
      cursor: pointer;
      color: white;
      background-color: #d9534f;
      border: none;
      border-radius: 3px;
      font-size: 11px;
      padding: 2px 6px;
      white-space: nowrap;
      min-width: 50px;
    }
    .cancel-button:hover {
      background-color: #c9302c;
    }
    .cancel-button[disabled] {
      background-color: #999;
      cursor: not-allowed;
    }
  `;

  _cancelToolCall = async (tool_call_id: string, button: HTMLButtonElement) => {
    button.innerText = "Cancelling";
    button.disabled = true;
    try {
      const response = await fetch("cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_call_id: tool_call_id,
          reason: "user requested cancellation",
        }),
      });
      if (response.ok) {
        button.parentElement.removeChild(button);
      } else {
        button.innerText = "Cancel";
      }
    } catch (e) {
      console.error("cancel", tool_call_id, e);
    }
  };

  _toggleDetails(e: Event) {
    e.stopPropagation();
    this.detailsVisible = !this.detailsVisible;
  }

  render() {
    // Status indicator based on result
    let statusIcon = html`<span class="tool-call-status spinner tool-pending"
      >⏳</span
    >`;
    if (this.toolCall?.result_message) {
      statusIcon = this.toolCall?.result_message.tool_error
        ? html`<span class="tool-call-status tool-error">〰️</span>`
        : html`<span class="tool-call-status tool-success">✓</span>`;
    }

    // Cancel button for pending operations
    const cancelButton = this.toolCall?.result_message
      ? ""
      : html`<button
          class="cancel-button"
          title="Cancel this operation"
          @click=${(e: Event) => {
            e.stopPropagation();
            this._cancelToolCall(
              this.toolCall?.tool_call_id,
              e.target as HTMLButtonElement,
            );
          }}
        >
          Cancel
        </button>`;

    // Elapsed time display
    const elapsed = this.toolCall?.result_message?.elapsed
      ? html`<span class="elapsed"
          >${(this.toolCall?.result_message?.elapsed / 1e9).toFixed(1)}s</span
        >`
      : html`<span class="elapsed"></span>`;

    // Initialize details visibility based on open property
    if (this.open && !this.detailsVisible) {
      this.detailsVisible = true;
    }

    return html`<div class="tool-call">
      <div class="tool-row" @click=${this._toggleDetails}>
        <span class="tool-name">${this.toolCall?.name}</span>
        <span class="summary-text"><slot name="summary"></slot></span>
        <div class="tool-status">${statusIcon} ${elapsed} ${cancelButton}</div>
      </div>
      <div class="tool-details ${this.detailsVisible ? "visible" : ""}">
        <slot name="input"></slot>
        <slot name="result"></slot>
      </div>
    </div>`;
  }
}

@customElement("sketch-tool-card-bash")
export class SketchToolCardBash extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = [
    commonStyles,
    css`
      :host {
        max-width: 100%;
        display: block;
      }
      .input {
        display: flex;
        width: 100%;
        max-width: 100%;
        flex-direction: column;
        overflow-wrap: break-word;
        word-break: break-word;
      }
      .command-wrapper {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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

    // Truncate the command if it's too long to display nicely
    const command = inputData?.command || "";
    const displayCommand =
      command.length > 80 ? command.substring(0, 80) + "..." : command;

    return html` <sketch-tool-card
      .open=${this.open}
      .toolCall=${this.toolCall}
    >
      <span
        slot="summary"
        class="summary-text"
        style="display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
      >
        <div
          class="command-wrapper"
          style="max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
        >
          ${backgroundIcon}${displayCommand}
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
          let statusIcon = "〰️";
          if (item.status == "yes") {
            statusIcon = "✅";
          } else if (item.status == "not applicable") {
            statusIcon = "🤷";
          }
          return html`<div>
            <span>${statusIcon}</span> ${key}:${item.status}
          </div>`;
        })}
      </div>
    </sketch-tool-card>`;
  }
}

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

@customElement("sketch-tool-card-set-slug")
export class SketchToolCardSetSlug extends LitElement {
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
          Slug: "${inputData.slug}"
        </span>
        <div slot="input">
          <div>Set slug to: <b>${inputData.slug}</b></div>
        </div>
      </sketch-tool-card>
    `;
  }
}

@customElement("sketch-tool-card-commit-message-style")
export class SketchToolCardCommitMessageStyle extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  @property()
  state: State;

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
  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  render() {
    return html`
      <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      </sketch-tool-card>
    `;
  }
}

@customElement("sketch-tool-card-multiple-choice")
export class SketchToolCardMultipleChoice extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;
  @property() selectedOption: MultipleChoiceOption = null;

  static styles = css`
    .options-container {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .option {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 4px;
      background-color: #f5f5f5;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      user-select: none;
    }
    .option:hover {
      background-color: #e0e0e0;
      border-color: #ccc;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .option:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      background-color: #d5d5d5;
    }
    .option.selected {
      background-color: #e3f2fd;
      border-color: #2196f3;
      border-width: 1px;
      border-style: solid;
    }
    .option-checkmark {
      margin-left: 6px;
      color: #2196f3;
    }
    .summary-text {
      font-style: italic;
      padding: 0.5em;
    }
    .summary-text strong {
      font-style: normal;
      color: #2196f3;
      font-weight: 600;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.updateSelectedOption();
  }

  updated(changedProps) {
    if (changedProps.has("toolCall")) {
      this.updateSelectedOption();
    }
  }

  updateSelectedOption() {
    if (this.toolCall?.result_message?.tool_result) {
      try {
        this.selectedOption = JSON.parse(
          this.toolCall.result_message.tool_result,
        ).selected;
      } catch (e) {
        console.error("Error parsing result:", e);
      }
    } else {
      this.selectedOption = null;
    }
  }

  async handleOptionClick(choice) {
    this.selectedOption = this.selectedOption === choice ? null : choice;

    const event = new CustomEvent("multiple-choice-selected", {
      detail: {
        responseText: this.selectedOption.responseText,
        toolCall: this.toolCall,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    let choices = [];
    let question = "";
    try {
      const inputData = JSON.parse(
        this.toolCall?.input || "{}",
      ) as MultipleChoiceParams;
      choices = inputData.responseOptions || [];
      question = inputData.question || "Please select an option:";
    } catch (e) {
      console.error("Error parsing multiple-choice input:", e);
    }

    const summaryContent =
      this.selectedOption !== null
        ? html`<span class="summary-text">
            ${question}: <strong>${this.selectedOption.caption}</strong>
          </span>`
        : html`<span class="summary-text">${question}</span>`;

    return html`
      <div class="multiple-choice-card">
        ${summaryContent}
        <div class="options-container">
          ${choices.map((choice) => {
            const isSelected =
              this.selectedOption !== null && this.selectedOption === choice;
            return html`
              <div
                class="option ${isSelected ? "selected" : ""}"
                @click=${() => this.handleOptionClick(choice)}
                title="${choice.responseText}"
              >
                <span class="option-label">${choice.caption}</span>
                ${isSelected
                  ? html`<span class="option-checkmark">✓</span>`
                  : ""}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

@customElement("sketch-tool-card-todo-write")
export class SketchToolCardTodoWrite extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .summary-text {
      font-style: italic;
      color: #666;
    }
  `;

  render() {
    const inputData = JSON.parse(this.toolCall?.input || "{}");
    const tasks = inputData.tasks || [];

    // Generate circles based on task status
    const circles = tasks
      .map((task) => {
        switch (task.status) {
          case "completed":
            return "●"; // full circle
          case "in-progress":
            return "◐"; // half circle
          case "queued":
          default:
            return "○"; // empty circle
        }
      })
      .join(" ");

    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span slot="summary" class="summary-text"> ${circles} </span>
      <div slot="result">
        <pre>${this.toolCall?.result_message?.tool_result}</pre>
      </div>
    </sketch-tool-card>`;
  }
}

@customElement("sketch-tool-card-keyword-search")
export class SketchToolCardKeywordSearch extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .summary-container {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .query-line {
      color: #333;
      font-family: inherit;
      font-size: 12px;
      font-weight: normal;
      white-space: normal;
      word-wrap: break-word;
      word-break: break-word;
      overflow-wrap: break-word;
      line-height: 1.2;
    }
    .keywords-line {
      color: #666;
      font-family: inherit;
      font-size: 11px;
      font-weight: normal;
      white-space: normal;
      word-wrap: break-word;
      word-break: break-word;
      overflow-wrap: break-word;
      line-height: 1.2;
      margin-top: 1px;
    }
  `;

  render() {
    const inputData = JSON.parse(this.toolCall?.input || "{}");
    const query = inputData.query || "";
    const searchTerms = inputData.search_terms || [];

    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <div slot="summary" class="summary-container">
        <div class="query-line">🔍 ${query}</div>
        <div class="keywords-line">🗝️ ${searchTerms.join(", ")}</div>
      </div>
      <div slot="input">
        <div><strong>Query:</strong> ${query}</div>
        <div><strong>Search terms:</strong> ${searchTerms.join(", ")}</div>
      </div>
      <div slot="result">
        <pre>${this.toolCall?.result_message?.tool_result}</pre>
      </div>
    </sketch-tool-card>`;
  }
}

@customElement("sketch-tool-card-todo-read")
export class SketchToolCardTodoRead extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  static styles = css`
    .summary-text {
      font-style: italic;
      color: #666;
    }
  `;

  render() {
    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span slot="summary" class="summary-text"> Read todo list </span>
      <div slot="result">
        <pre>${this.toolCall?.result_message?.tool_result}</pre>
      </div>
    </sketch-tool-card>`;
  }
}

@customElement("sketch-tool-card-generic")
export class SketchToolCardGeneric extends LitElement {
  @property() toolCall: ToolCall;
  @property() open: boolean;

  render() {
    return html`<sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
      <span
        slot="summary"
        style="display: block; white-space: normal; word-break: break-word; overflow-wrap: break-word; max-width: 100%; width: 100%;"
        >${this.toolCall?.input}</span
      >
      <div
        slot="input"
        style="max-width: 100%; overflow-wrap: break-word; word-break: break-word;"
      >
        Input:
        <pre
          style="max-width: 100%; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;"
        >
${this.toolCall?.input}</pre
        >
      </div>
      <div
        slot="result"
        style="max-width: 100%; overflow-wrap: break-word; word-break: break-word;"
      >
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
    "sketch-tool-card": SketchToolCard;
    "sketch-tool-card-generic": SketchToolCardGeneric;
    "sketch-tool-card-bash": SketchToolCardBash;
    "sketch-tool-card-codereview": SketchToolCardCodeReview;
    "sketch-tool-card-done": SketchToolCardDone;
    "sketch-tool-card-patch": SketchToolCardPatch;
    "sketch-tool-card-think": SketchToolCardThink;
    "sketch-tool-card-set-slug": SketchToolCardSetSlug;
    "sketch-tool-card-commit-message-style": SketchToolCardCommitMessageStyle;
    "sketch-tool-card-multiple-choice": SketchToolCardMultipleChoice;
    "sketch-tool-card-todo-write": SketchToolCardTodoWrite;
    "sketch-tool-card-todo-read": SketchToolCardTodoRead;
    "sketch-tool-card-keyword-search": SketchToolCardKeywordSearch;
    // TODO: We haven't implemented this for browser tools.
  }
}
