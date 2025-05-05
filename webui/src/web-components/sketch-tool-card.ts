import { css, html, LitElement } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property, state } from "lit/decorators.js";
import { ToolCall, MultipleChoiceOption, MultipleChoiceParams } from "../types";
import { marked, MarkedOptions } from "marked";

function renderMarkdown(markdownContent: string): string {
  try {
    // Set markdown options for proper code block highlighting and safety
    const markedOptions: MarkedOptions = {
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert newlines to <br>
      async: false,
      // DOMPurify is recommended for production, but not included in this implementation
    };
    return marked.parse(markdownContent, markedOptions) as string;
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to plain text if markdown parsing fails
    return markdownContent;
  }
}

@customElement("sketch-tool-card")
export class SketchToolCard extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  @state()
  detailsVisible: boolean = false;

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
      gap: 8px; /* Reduce gap slightly to accommodate longer tool names */
      cursor: pointer;
      border-radius: 4px;
      position: relative;
      overflow: hidden; /* Changed to hidden to prevent horizontal scrolling */
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
      /* Remove max-width to prevent truncation */
      font-size: 12px;
      text-align: center;
      /* Remove overflow/ellipsis to ensure names are fully visible */
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
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      flex-grow: 1;
      flex-shrink: 1;
      color: #444;
      font-family: monospace;
      font-size: 12px;
      padding: 0 4px;
      min-width: 50px;
      max-width: calc(
        100% - 250px
      ); /* More space for tool-name and tool-status */
      display: inline-block; /* Ensure proper truncation */
    }

    .tool-status {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
      flex-shrink: 0;
      min-width: 120px; /* Increased width to prevent cutoff */
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
      overflow: hidden; /* Hide overflow at container level */
    }

    .tool-details.visible {
      display: block;
    }

    .expand-indicator {
      color: #aaa;
      font-size: 10px;
      width: 12px;
      display: inline-block;
      text-align: center;
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

    .tool-error-message {
      font-style: italic;
      color: #6c757d;
    }

    .codereview-OK {
      color: green;
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

  _cancelToolCall = async (tool_call_id: string, button: HTMLButtonElement) => {
    console.log("cancelToolCall", tool_call_id, button);
    button.innerText = "Cancelling";
    button.disabled = true;
    try {
      const response = await fetch("cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_call_id: tool_call_id,
          reason: "user requested cancellation",
        }),
      });
      if (response.ok) {
        console.log("cancel", tool_call_id, response);
        button.parentElement.removeChild(button);
      } else {
        button.innerText = "Cancel";
        console.log(`error trying to cancel ${tool_call_id}: `, response);
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
    // Determine the status indicator based on the tool call result
    let statusIcon;
    if (!this.toolCall?.result_message) {
      // Pending status with spinner
      statusIcon = html`<span class="tool-call-status spinner tool-pending"
        >⏳</span
      >`;
    } else if (this.toolCall?.result_message.tool_error) {
      // Error status
      statusIcon = html`<span class="tool-call-status tool-error">🔔</span>`;
    } else {
      // Success status
      statusIcon = html`<span class="tool-call-status tool-success">✓</span>`;
    }

    // Cancel button for pending operations
    const cancelButton = this.toolCall?.result_message
      ? ""
      : html`<button
          class="cancel-button"
          title="Cancel this operation"
          @click=${(e: Event) => {
            e.stopPropagation();
            const button = e.target as HTMLButtonElement;
            this._cancelToolCall(this.toolCall?.tool_call_id, button);
          }}
        >
          Cancel
        </button>`;

    // Elapsed time display
    const elapsed = this.toolCall?.result_message?.elapsed
      ? html`<span class="elapsed"
          >${(this.toolCall?.result_message?.elapsed / 1e9).toFixed(1)}s</span
        >`
      : html`<span class="elapsed"></span>`; // Empty span to maintain layout

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
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  static styles = css`
    pre {
      background: rgb(236, 236, 236);
      color: black;
      padding: 0.5em;
      border-radius: 4px;
      white-space: pre-wrap; /* Always wrap long lines */
      word-break: break-word; /* Use break-word for a more readable break */
      max-width: 100%;
      width: 100%;
      box-sizing: border-box;
      overflow-wrap: break-word; /* Additional property for better wrapping */
    }
    .summary-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
      font-family: monospace;
    }

    .command-wrapper {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    .input {
      display: flex;
      width: 100%;
      flex-direction: column; /* Change to column layout */
    }
    .input pre {
      width: 100%;
      margin-bottom: 0;
      border-radius: 4px 4px 0 0;
      box-sizing: border-box; /* Include padding in width calculation */
    }
    .result pre {
      margin-top: 0;
      color: #555;
      border-radius: 0 0 4px 4px;
      width: 100%; /* Ensure it uses full width */
      box-sizing: border-box; /* Include padding in width calculation */
      overflow-wrap: break-word; /* Ensure long words wrap */
    }

    /* Add a special class for long output that should be scrollable on hover */
    .result pre.scrollable-on-hover {
      max-height: 300px;
      overflow-y: auto;
    }

    /* Container for tool call results with proper text wrapping */
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
    const inputData = JSON.parse(this.toolCall?.input || "{}");
    const isBackground = inputData?.background === true;
    const backgroundIcon = isBackground ? "🔄 " : "";

    return html`
    <sketch-tool-card .open=${this.open} .toolCall=${this.toolCall}>
    <span slot="summary" class="summary-text">
      <div class="command-wrapper">
        ${backgroundIcon}${inputData?.command}
      </div>
    </span>
    <div slot="input" class="input">
      <div class="tool-call-result-container">
        <pre>${backgroundIcon}${inputData?.command}</pre>
      </div>
    </div>
    ${
      this.toolCall?.result_message
        ? html` ${this.toolCall?.result_message.tool_result
            ? html`<div slot="result" class="result">
                <div class="tool-call-result-container">
                  <pre class="tool-call-result">
${this.toolCall?.result_message.tool_result}</pre
                  >
                </div>
              </div>`
            : ""}`
        : ""
    }</div>
    </sketch-tool-card>`;
  }
}

@customElement("sketch-tool-card-codereview")
export class SketchToolCardCodeReview extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  static styles = css``;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }
  // Determine the status icon based on the content of the result message
  // This corresponds to the output format in claudetool/differential.go:Run
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

    return html` <sketch-tool-card
      .open=${this.open}
      .toolCall=${this.toolCall}
    >
      <span slot="summary" class="summary-text"> ${statusIcon} </span>
      <div slot="result">
        <pre>${resultText}</pre>
      </div>
    </sketch-tool-card>`;
  }
}

@customElement("sketch-tool-card-done")
export class SketchToolCardDone extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  static styles = css``;

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
    const doneInput = JSON.parse(this.toolCall.input);
    return html` <sketch-tool-card
      .open=${this.open}
      .toolCall=${this.toolCall}
    >
      <span slot="summary" class="summary-text"> </span>
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

@customElement("sketch-tool-card-patch")
export class SketchToolCardPatch extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

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
    const patchInput = JSON.parse(this.toolCall?.input);
    return html` <sketch-tool-card
      .open=${this.open}
      .toolCall=${this.toolCall}
    >
      <span slot="summary" class="summary-text">
        ${patchInput?.path}: ${patchInput.patches.length}
        edit${patchInput.patches.length > 1 ? "s" : ""}
      </span>
      <div slot="input">
        ${patchInput.patches.map((patch) => {
          return html` Patch operation: <b>${patch.operation}</b>
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
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

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
        <span slot="summary" class="summary-text"
          >${JSON.parse(this.toolCall?.input)?.thoughts?.split("\n")[0]}</span
        >
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

@customElement("sketch-tool-card-title")
export class SketchToolCardTitle extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

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

@customElement("sketch-tool-card-multiple-choice")
export class SketchToolCardMultipleChoice extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

  @property()
  selectedOption: MultipleChoiceOption = null;

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

    .option-index {
      font-size: 0.8em;
      opacity: 0.7;
      margin-right: 6px;
    }

    .option-label {
      font-family: sans-serif;
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

    p {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
  `;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateSelectedOption();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  updated(changedProps) {
    if (changedProps.has("toolCall")) {
      this.updateSelectedOption();
    }
  }

  updateSelectedOption() {
    // Get selected option from result if available
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
    // If this option is already selected, unselect it (toggle behavior)
    if (this.selectedOption === choice) {
      this.selectedOption = null;
    } else {
      // Otherwise, select the clicked option
      this.selectedOption = choice;
    }

    // Dispatch a custom event that can be listened to by parent components
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
    // Parse the input to get choices if available
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

    // Determine what to show in the summary slot
    const summaryContent =
      this.selectedOption !== null
        ? html`<span class="summary-text"
            >${question}: <strong>${this.selectedOption.caption}</strong></span
          >`
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

@customElement("sketch-tool-card-generic")
export class SketchToolCardGeneric extends LitElement {
  @property()
  toolCall: ToolCall;

  @property()
  open: boolean;

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
    return html` <sketch-tool-card
      .open=${this.open}
      .toolCall=${this.toolCall}
    >
      <span slot="summary" class="summary-text">${this.toolCall?.input}</span>
      <div slot="input">
        Input:
        <pre>${this.toolCall?.input}</pre>
      </div>
      <div slot="result">
        Result:
        ${this.toolCall?.result_message
          ? html` ${this.toolCall?.result_message.tool_result
              ? html`<pre>${this.toolCall?.result_message.tool_result}</pre>`
              : ""}`
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
    "sketch-tool-card-title": SketchToolCardTitle;
    "sketch-tool-card-multiple-choice": SketchToolCardMultipleChoice;
  }
}
