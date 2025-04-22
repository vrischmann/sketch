import { css, html, LitElement } from "lit";
import { PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { customElement, property, state } from "lit/decorators.js";
import { AgentMessage } from "../types";
import "./sketch-timeline-message";

@customElement("sketch-timeline")
export class SketchTimeline extends LitElement {
  @property()
  messages: AgentMessage[] = [];

  // Track if we should scroll to the bottom
  @state()
  private scrollingState: "pinToLatest" | "floating" = "pinToLatest";

  @property()
  scrollContainer: HTMLDivElement;

  static styles = css`
    /* Hide views initially to prevent flash of content */
    .timeline-container .timeline,
    .timeline-container .diff-view,
    .timeline-container .chart-view,
    .timeline-container .terminal-view {
      visibility: hidden;
    }

    /* Will be set by JavaScript once we know which view to display */
    .timeline-container.view-initialized .timeline,
    .timeline-container.view-initialized .diff-view,
    .timeline-container.view-initialized .chart-view,
    .timeline-container.view-initialized .terminal-view {
      visibility: visible;
    }

    .timeline-container {
      width: 100%;
      position: relative;
    }

    /* Timeline styles that should remain unchanged */
    .timeline {
      position: relative;
      margin: 10px 0;
      scroll-behavior: smooth;
    }

    .timeline::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 15px;
      width: 2px;
      background: #e0e0e0;
      border-radius: 1px;
    }

    /* Hide the timeline vertical line when there are no messages */
    .timeline.empty::before {
      display: none;
    }

    #scroll-container {
      overflow: auto;
      padding-left: 1em;
    }
    #jump-to-latest {
      display: none;
      position: fixed;
      bottom: 100px;
      right: 0;
      background: rgb(33, 150, 243);
      color: white;
      border-radius: 8px;
      padding: 0.5em;
      margin: 0.5em;
      font-size: x-large;
      opacity: 0.5;
      cursor: pointer;
    }
    #jump-to-latest:hover {
      opacity: 1;
    }
    #jump-to-latest.floating {
      display: block;
    }
  `;

  constructor() {
    super();

    // Binding methods
    this._handleShowCommitDiff = this._handleShowCommitDiff.bind(this);
    this._handleScroll = this._handleScroll.bind(this);
  }

  /**
   * Scroll to the bottom of the timeline
   */
  private scrollToBottom(): void {
    this.scrollContainer?.scrollTo({
      top: this.scrollContainer?.scrollHeight,
      behavior: "smooth",
    });
  }

  /**
   * Called after the component's properties have been updated
   */
  updated(changedProperties: PropertyValues): void {
    // If messages have changed, scroll to bottom if needed
    if (changedProperties.has("messages") && this.messages.length > 0) {
      if (this.scrollingState == "pinToLatest") {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    }
    if (changedProperties.has("scrollContainer")) {
      this.scrollContainer?.addEventListener("scroll", this._handleScroll);
    }
  }

  /**
   * Handle showCommitDiff event
   */
  private _handleShowCommitDiff(event: CustomEvent) {
    const { commitHash } = event.detail;
    if (commitHash) {
      // Bubble up the event to the app shell
      const newEvent = new CustomEvent("show-commit-diff", {
        detail: { commitHash },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(newEvent);
    }
  }

  private _handleScroll(event) {
    const isAtBottom =
      Math.abs(
        this.scrollContainer.scrollHeight -
          this.scrollContainer.clientHeight -
          this.scrollContainer.scrollTop,
      ) <= 1;
    if (isAtBottom) {
      this.scrollingState = "pinToLatest";
    } else {
      // TODO: does scroll direction matter here?
      this.scrollingState = "floating";
    }
  }

  // See https://lit.dev/docs/components/lifecycle/
  connectedCallback() {
    super.connectedCallback();

    // Listen for showCommitDiff events from the renderer
    document.addEventListener(
      "showCommitDiff",
      this._handleShowCommitDiff as EventListener,
    );
    this.scrollContainer?.addEventListener("scroll", this._handleScroll);
  }

  // See https://lit.dev/docs/components/lifecycle/
  disconnectedCallback() {
    super.disconnectedCallback();

    // Remove event listeners
    document.removeEventListener(
      "showCommitDiff",
      this._handleShowCommitDiff as EventListener,
    );

    this.scrollContainer?.removeEventListener("scroll", this._handleScroll);
  }

  // messageKey uniquely identifes a AgentMessage based on its ID and tool_calls, so
  // that we only re-render <sketch-message> elements that we need to re-render.
  messageKey(message: AgentMessage): string {
    // If the message has tool calls, and any of the tool_calls get a response, we need to
    // re-render that message.
    const toolCallResponses = message.tool_calls
      ?.filter((tc) => tc.result_message)
      .map((tc) => tc.tool_call_id)
      .join("-");
    return `message-${message.idx}-${toolCallResponses}`;
  }

  render() {
    return html`
      <div id="scroll-container">
        <div class="timeline-container">
          ${repeat(this.messages, this.messageKey, (message, index) => {
            let previousMessage: AgentMessage;
            if (index > 0) {
              previousMessage = this.messages[index - 1];
            }
            return html`<sketch-timeline-message
              .message=${message}
              .previousMessage=${previousMessage}
              .open=${index == this.messages.length - 1}
            ></sketch-timeline-message>`;
          })}
        </div>
      </div>
      <div
        id="jump-to-latest"
        class="${this.scrollingState}"
        @click=${this.scrollToBottom}
      >
        ⇩
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-timeline": SketchTimeline;
  }
}
