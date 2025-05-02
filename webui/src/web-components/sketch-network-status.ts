import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("sketch-network-status")
export class SketchNetworkStatus extends LitElement {
  @property()
  connection: string;

  @property()
  error: string;

  // See https://lit.dev/docs/components/styles/ for how lit-element handles CSS.
  // Note that these styles only apply to the scope of this web component's
  // shadow DOM node, so they won't leak out or collide with CSS declared in
  // other components or the containing web page (...unless you want it to do that).

  static styles = css`
    .status-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status-indicator.connected {
      background-color: #2e7d32; /* Green */
      box-shadow: 0 0 5px rgba(46, 125, 50, 0.5);
    }

    .status-indicator.disconnected {
      background-color: #d32f2f; /* Red */
      box-shadow: 0 0 5px rgba(211, 47, 47, 0.5);
    }

    .status-indicator.connecting {
      background-color: #f57c00; /* Orange */
      box-shadow: 0 0 5px rgba(245, 124, 0, 0.5);
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% {
        opacity: 0.6;
      }
      50% {
        opacity: 1;
      }
      100% {
        opacity: 0.6;
      }
    }
  `;

  constructor() {
    super();
  }

  // See https://lit.dev/docs/components/lifecycle/
  connectedCallback() {
    super.connectedCallback();
  }

  // See https://lit.dev/docs/components/lifecycle/
  disconnectedCallback() {
    super.disconnectedCallback();
  }

  render() {
    // Only show the status indicator dot (no text)
    return html`
      <div class="status-container">
        <div
          class="status-indicator ${this.connection}"
          title="Connection status: ${this.connection}${this.error
            ? ` - ${this.error}`
            : ""}"
        ></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-network-status": SketchNetworkStatus;
  }
}
