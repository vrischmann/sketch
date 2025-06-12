import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { State, ToolCall } from "../types";
import "./sketch-tool-card";
import "./sketch-tool-card-take-screenshot";
import "./sketch-tool-card-about-sketch";
import "./sketch-tool-card-browser-navigate";
import "./sketch-tool-card-browser-click";
import "./sketch-tool-card-browser-type";
import "./sketch-tool-card-browser-wait-for";
import "./sketch-tool-card-browser-get-text";
import "./sketch-tool-card-browser-eval";
import "./sketch-tool-card-browser-scroll-into-view";
import "./sketch-tool-card-browser-resize";
import "./sketch-tool-card-read-image";
import "./sketch-tool-card-browser-recent-console-logs";
import "./sketch-tool-card-browser-clear-console-logs";

@customElement("sketch-tool-calls")
export class SketchToolCalls extends LitElement {
  @property()
  toolCalls: ToolCall[] = [];

  @property()
  open: boolean = false;

  @property()
  state: State;

  @state()
  expanded: boolean = false;

  static styles = css`
    /* Tool calls container styles */
    .tool-calls-container {
      margin-top: 8px;
      padding-top: 4px;
      max-width: 100%;
      width: 100%;
      box-sizing: border-box;
    }

    /* Card container */
    .tool-call-card {
      display: flex;
      flex-direction: column;
      background-color: rgba(255, 255, 255, 0.6);
      border-radius: 6px;
      margin-bottom: 6px;
      overflow: hidden;
      cursor: pointer;
      border-left: 2px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      max-width: 100%;
      overflow-wrap: break-word;
      word-break: break-word;
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

    .tool-call-cards-container {
      display: block;
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
      case "multiplechoice":
        return html`<sketch-tool-card-multiple-choice
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-multiple-choice>`;
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
      case "set-slug":
        return html`<sketch-tool-card-set-slug
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-set-slug>`;
      case "commit-message-style":
        return html`<sketch-tool-card-commit-message-style
          .open=${open}
          .toolCall=${toolCall}
          .state=${this.state}
        ></sketch-tool-card-commit-message-style>`;
      case "browser_take_screenshot":
        return html`<sketch-tool-card-take-screenshot
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-take-screenshot>`;
      case "about_sketch":
        return html`<sketch-tool-card-about-sketch
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-about-sketch>`;
      case "todo_write":
        return html`<sketch-tool-card-todo-write
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-todo-write>`;
      case "todo_read":
        return html`<sketch-tool-card-todo-read
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-todo-read>`;
      case "browser_navigate":
        return html`<sketch-tool-card-browser-navigate
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-navigate>`;
      case "keyword_search":
        return html`<sketch-tool-card-keyword-search
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-keyword-search>`;
      case "browser_click":
        return html`<sketch-tool-card-browser-click
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-click>`;
      case "browser_type":
        return html`<sketch-tool-card-browser-type
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-type>`;
      case "browser_wait_for":
        return html`<sketch-tool-card-browser-wait-for
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-wait-for>`;
      case "browser_get_text":
        return html`<sketch-tool-card-browser-get-text
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-get-text>`;
      case "browser_eval":
        return html`<sketch-tool-card-browser-eval
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-eval>`;
      case "browser_scroll_into_view":
        return html`<sketch-tool-card-browser-scroll-into-view
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-scroll-into-view>`;
      case "browser_resize":
        return html`<sketch-tool-card-browser-resize
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-resize>`;
      case "read_image":
        return html`<sketch-tool-card-read-image
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-read-image>`;
      case "browser_recent_console_logs":
        return html`<sketch-tool-card-browser-recent-console-logs
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-recent-console-logs>`;
      case "browser_clear_console_logs":
        return html`<sketch-tool-card-browser-clear-console-logs
          .open=${open}
          .toolCall=${toolCall}
        ></sketch-tool-card-browser-clear-console-logs>`;
    }
    return html`<sketch-tool-card-generic
      .open=${open}
      .toolCall=${toolCall}
    ></sketch-tool-card-generic>`;
  }

  // toolUseKey return value should change, if the toolCall gets a response.
  toolUseKey(toolCall: ToolCall): string {
    if (!toolCall.result_message) {
      return toolCall.tool_call_id;
    }
    return `${toolCall.tool_call_id}-${toolCall.result_message.idx}`;
  }

  render() {
    if (!this.toolCalls || this.toolCalls.length === 0) {
      return html``;
    }

    return html`<div class="tool-calls-container">
      <div class="tool-call-cards-container">
        ${repeat(this.toolCalls, this.toolUseKey, (toolCall, idx) => {
          let shouldOpen = false;
          // Always expand screenshot tool calls, expand last tool call if this.open is true
          if (
            toolCall.name === "browser_take_screenshot" ||
            (idx == this.toolCalls?.length - 1 && this.open)
          ) {
            shouldOpen = true;
          }
          return html`<div
            id="${toolCall.tool_call_id}"
            class="tool-call-card ${toolCall.name}"
          >
            ${this.cardForToolCall(toolCall, shouldOpen)}
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
