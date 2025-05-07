import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToolCall, MultipleChoiceOption, MultipleChoiceParams } from "../types";

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

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-card-multiple-choice": SketchToolCardMultipleChoice;
  }
}
