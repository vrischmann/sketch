import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { SketchTailwindElement } from "./sketch-tailwind-element.js";

@customElement("sketch-call-status")
export class SketchCallStatus extends SketchTailwindElement {
  @property()
  llmCalls: number = 0;

  @property()
  toolCalls: string[] = [];

  @property()
  agentState: string | null = null;

  @property()
  isIdle: boolean = false;

  @property()
  isDisconnected: boolean = false;

  render() {
    const lightbulbSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
      <path d="M9 18h6"></path>
      <path d="M10 22h4"></path>
    </svg>`;

    const wrenchSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>`;

    const agentState = `${this.agentState ? " (" + this.agentState + ")" : ""}`;

    // Determine state - disconnected takes precedence, then working vs idle
    let statusClass = "status-idle";
    let statusText = "IDLE";

    if (this.isDisconnected) {
      statusClass = "status-disconnected";
      statusText = "DISCONNECTED";
    } else if (!this.isIdle) {
      statusClass = "status-working";
      statusText = "WORKING";
    }

    return html`
      <style>
        @keyframes gentle-pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-gentle-pulse {
          animation: gentle-pulse 1.5s infinite ease-in-out;
        }
      </style>
      <div class="flex relative items-center px-2.5">
        <div class="flex items-center gap-2.5 relative">
          <div
            class="llm-indicator flex justify-center items-center w-8 h-8 rounded transition-all duration-200 relative ${this
              .llmCalls > 0
              ? "bg-yellow-100 text-amber-500 animate-gentle-pulse active"
              : "bg-transparent text-gray-400"}"
            title="${this.llmCalls > 0
              ? `${this.llmCalls} LLM ${this.llmCalls === 1 ? "call" : "calls"} in progress`
              : "No LLM calls in progress"}${agentState}"
          >
            <div class="w-5 h-5">${unsafeHTML(lightbulbSVG)}</div>
          </div>
          <div
            class="tool-indicator flex justify-center items-center w-8 h-8 rounded transition-all duration-200 relative ${this
              .toolCalls.length > 0
              ? "bg-blue-100 text-blue-500 animate-gentle-pulse active"
              : "bg-transparent text-gray-400"}"
            title="${this.toolCalls.length > 0
              ? `${this.toolCalls.length} tool ${this.toolCalls.length === 1 ? "call" : "calls"} in progress: ${this.toolCalls.join(", ")}`
              : "No tool calls in progress"}${agentState}"
          >
            <div class="w-5 h-5">${unsafeHTML(wrenchSVG)}</div>
          </div>
        </div>
        <div
          class="status-banner absolute py-0.5 px-1.5 rounded text-xs font-bold text-center tracking-wider w-26 left-1/2 transform -translate-x-1/2 top-3/5 z-10 opacity-90 ${statusClass} ${this
            .isDisconnected
            ? "bg-red-50 text-red-600"
            : !this.isIdle
              ? "bg-orange-50 text-orange-600"
              : "bg-green-50 text-green-700"}"
        >
          ${statusText}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-call-status": SketchCallStatus;
  }
}
