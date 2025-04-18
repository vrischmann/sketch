import { css, html, LitElement } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { customElement, property } from "lit/decorators.js";
import { State, ToolCall } from "../types";
import { marked, MarkedOptions } from "marked";
import "./sketch-tool-card";

@customElement("sketch-tool-calls")
export class SketchToolCalls extends LitElement {
  @property()
  toolCalls: ToolCall[] = [];

  static styles = css`
    /* Tool calls container styles */
    .tool-calls-container {
      /* Container for all tool calls */
    }

    /* Header for tool calls section */
    .tool-calls-header {
      /* Empty header - just small spacing */
    }

    /* Card container */
    .tool-call-card {
      display: flex;
      flex-direction: column;
      background-color: white;
      overflow: hidden;
      cursor: pointer;
    }

    /* Status indicators for tool calls */
    .tool-call-status {
      margin-right: 4px;
      text-align: center;
    }

    .tool-call-status.spinner {
      animation: spin 1s infinite linear;
      display: inline-block;
      width: 1em;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
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

  cardForToolCall(toolCall: ToolCall, open: boolean) {
    switch (toolCall.name) {
      case "bash":
        return html`<sketch-tool-card-bash
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-bash>`;
      case "codereview":
        return html`<sketch-tool-card-codereview
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-codereview>`;
      case "done":
        return html`<sketch-tool-card-done
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-done>`;
      case "patch":
        return html`<sketch-tool-card-patch
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-patch>`;
      case "think":
        return html`<sketch-tool-card-think
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-think>`;
      case "title":
        return html`<sketch-tool-card-title
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-title>`;
    }
    return html`<sketch-tool-card-generic
      .open=${open}
      .toolCall=${toolCall}
    ></sketch-tool-card-generic>`;
  }

  render() {
    return html`<div class="tool-calls-container">
      <div class="tool-calls-header"></div>
      <div class="tool-call-cards-container">
        ${this.toolCalls?.map((toolCall, idx) => {
          let lastCall = false;
          if (idx == this.toolCalls?.length - 1) {
            lastCall = true;
          }
          return html`<div
            id="${toolCall.tool_call_id}"
            class="tool-call-card ${toolCall.name}"
          >
            ${this.cardForToolCall(toolCall, lastCall)}
          </div>`;
        })}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-tool-calls": SketchToolCalls;
  }
}
