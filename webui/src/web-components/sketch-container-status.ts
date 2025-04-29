import { State } from "../types";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatNumber } from "../utils";

@customElement("sketch-container-status")
export class SketchContainerStatus extends LitElement {
  // Header bar: Container status details

  @property()
  state: State;

  @state()
  showDetails: boolean = false;

  // See https://lit.dev/docs/components/styles/ for how lit-element handles CSS.
  // Note that these styles only apply to the scope of this web component's
  // shadow DOM node, so they won't leak out or collide with CSS declared in
  // other components or the containing web page (...unless you want it to do that).
  static styles = css`
    .info-container {
      display: flex;
      align-items: center;
      position: relative;
    }

    .info-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: #f9f9f9;
      border-radius: 4px;
      padding: 4px 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      flex: 1;
    }

    .info-expanded {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 10;
      min-width: 400px;
      background: white;
      border-radius: 8px;
      padding: 10px 15px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
      margin-top: 5px;
      display: none;
    }

    .info-expanded.active {
      display: block;
    }

    .info-item {
      display: flex;
      align-items: center;
      white-space: nowrap;
      margin-right: 10px;
      font-size: 13px;
    }

    .info-label {
      font-size: 11px;
      color: #555;
      margin-right: 3px;
      font-weight: 500;
    }

    .info-value {
      font-size: 11px;
      font-weight: 600;
    }

    [title] {
      cursor: help;
      text-decoration: underline dotted;
    }

    .cost {
      color: #2e7d32;
    }

    .info-item a {
      --tw-text-opacity: 1;
      color: rgb(37 99 235 / var(--tw-text-opacity, 1));
      text-decoration: inherit;
    }

    .info-toggle {
      margin-left: 8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0f0f0;
      border: 1px solid #ddd;
      cursor: pointer;
      font-weight: bold;
      font-style: italic;
      color: #555;
      transition: all 0.2s ease;
    }

    .info-toggle:hover {
      background: #e0e0e0;
    }

    .info-toggle.active {
      background: #4a90e2;
      color: white;
      border-color: #3a80d2;
    }

    .main-info-grid {
      display: flex;
      gap: 20px;
    }

    .info-column {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .detailed-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
      margin-top: 10px;
    }

    .ssh-section {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }

    .ssh-command {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      gap: 10px;
    }

    .ssh-command-text {
      font-family: monospace;
      font-size: 12px;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
      flex-grow: 1;
    }

    .copy-button {
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-button:hover {
      background: #e0e0e0;
    }

    .ssh-warning {
      background: #fff3e0;
      border-left: 3px solid #ff9800;
      padding: 8px 12px;
      margin-top: 8px;
      font-size: 12px;
      color: #e65100;
    }

    .vscode-link {
      color: #2962ff;
      text-decoration: none;
    }

    .vscode-link:hover {
      text-decoration: underline;
    }
  `;

  constructor() {
    super();
    this._toggleInfoDetails = this._toggleInfoDetails.bind(this);

    // Close the info panel when clicking outside of it
    document.addEventListener("click", (event) => {
      if (this.showDetails && !this.contains(event.target as Node)) {
        this.showDetails = false;
        this.requestUpdate();
      }
    });
  }

  /**
   * Toggle the display of detailed information
   */
  private _toggleInfoDetails(event: Event) {
    event.stopPropagation();
    this.showDetails = !this.showDetails;
    this.requestUpdate();
  }

  formatHostname() {
    const outsideHostname = this.state?.outside_hostname;
    const insideHostname = this.state?.inside_hostname;

    if (!outsideHostname || !insideHostname) {
      return this.state?.hostname;
    }

    if (outsideHostname === insideHostname) {
      return outsideHostname;
    }

    return `${outsideHostname}:${insideHostname}`;
  }

  formatWorkingDir() {
    const outsideWorkingDir = this.state?.outside_working_dir;
    const insideWorkingDir = this.state?.inside_working_dir;

    if (!outsideWorkingDir || !insideWorkingDir) {
      return this.state?.working_dir;
    }

    if (outsideWorkingDir === insideWorkingDir) {
      return outsideWorkingDir;
    }

    return `${outsideWorkingDir}:${insideWorkingDir}`;
  }

  getHostnameTooltip() {
    const outsideHostname = this.state?.outside_hostname;
    const insideHostname = this.state?.inside_hostname;

    if (
      !outsideHostname ||
      !insideHostname ||
      outsideHostname === insideHostname
    ) {
      return "";
    }

    return `Outside: ${outsideHostname}, Inside: ${insideHostname}`;
  }

  getWorkingDirTooltip() {
    const outsideWorkingDir = this.state?.outside_working_dir;
    const insideWorkingDir = this.state?.inside_working_dir;

    if (
      !outsideWorkingDir ||
      !insideWorkingDir ||
      outsideWorkingDir === insideWorkingDir
    ) {
      return "";
    }

    return `Outside: ${outsideWorkingDir}, Inside: ${insideWorkingDir}`;
  }

  // See https://lit.dev/docs/components/lifecycle/
  connectedCallback() {
    super.connectedCallback();
    // register event listeners
  }

  // See https://lit.dev/docs/components/lifecycle/
  disconnectedCallback() {
    super.disconnectedCallback();
    // unregister event listeners
  }

  copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Could add a temporary success indicator here
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
      });
  }

  getSSHHostname() {
    return `sketch-${this.state?.session_id}`;
  }

  renderSSHSection() {
    // Only show SSH section if we're in a Docker container and have session ID
    if (!this.state?.session_id) {
      return html``;
    }

    const sshHost = this.getSSHHostname();
    const sshCommand = `ssh ${sshHost}`;
    const vscodeCommand = `code --remote ssh-remote+root@${sshHost} /app -n`;
    const vscodeURL = `vscode://vscode-remote/ssh-remote+root@${sshHost}/app?windowId=_blank`;

    if (!this.state?.ssh_available) {
      return html`
        <div class="ssh-section">
          <h3>SSH Connection</h3>
          <div class="ssh-warning">
            SSH connections are not available:
            ${this.state?.ssh_error || "SSH configuration is missing"}
          </div>
        </div>
      `;
    }

    return html`
      <div class="ssh-section">
        <h3>SSH Connection</h3>
        <div class="ssh-command">
          <div class="ssh-command-text">${sshCommand}</div>
          <button
            class="copy-button"
            @click=${() => this.copyToClipboard(sshCommand)}
          >
            Copy
          </button>
        </div>
        <div class="ssh-command">
          <div class="ssh-command-text">${vscodeCommand}</div>
          <button
            class="copy-button"
            @click=${() => this.copyToClipboard(vscodeCommand)}
          >
            Copy
          </button>
        </div>
        <div class="ssh-command">
          <a href="${vscodeURL}" class="vscode-link">${vscodeURL}</a>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="info-container">
        <!-- Main visible info in two columns - hostname/dir and repo/cost -->
        <div class="main-info-grid">
          <!-- First column: hostname and working dir -->
          <div class="info-column">
            <div class="info-item">
              <span
                id="hostname"
                class="info-value"
                title="${this.getHostnameTooltip()}"
              >
                ${this.formatHostname()}
              </span>
            </div>
            <div class="info-item">
              <span
                id="workingDir"
                class="info-value"
                title="${this.getWorkingDirTooltip()}"
              >
                ${this.formatWorkingDir()}
              </span>
            </div>
          </div>

          <!-- Second column: git repo and cost -->
          <div class="info-column">
            ${this.state?.git_origin
              ? html`
                  <div class="info-item">
                    <span id="gitOrigin" class="info-value"
                      >${this.state?.git_origin}</span
                    >
                  </div>
                `
              : ""}
            <div class="info-item">
              <span id="totalCost" class="info-value cost"
                >$${(this.state?.total_usage?.total_cost_usd || 0).toFixed(
                  2,
                )}</span
              >
            </div>
          </div>
        </div>

        <!-- Info toggle button -->
        <button
          class="info-toggle ${this.showDetails ? "active" : ""}"
          @click=${this._toggleInfoDetails}
          title="Show/hide details"
        >
          i
        </button>

        <!-- Expanded info panel -->
        <div class="info-expanded ${this.showDetails ? "active" : ""}">
          <div class="detailed-info-grid">
            <div class="info-item">
              <span class="info-label">Commit:</span>
              <span id="initialCommit" class="info-value"
                >${this.state?.initial_commit?.substring(0, 8)}</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">Msgs:</span>
              <span id="messageCount" class="info-value"
                >${this.state?.message_count}</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">Input tokens:</span>
              <span id="inputTokens" class="info-value"
                >${formatNumber(
                  (this.state?.total_usage?.input_tokens || 0) +
                    (this.state?.total_usage?.cache_read_input_tokens || 0) +
                    (this.state?.total_usage?.cache_creation_input_tokens || 0),
                )}</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">Output tokens:</span>
              <span id="outputTokens" class="info-value"
                >${formatNumber(this.state?.total_usage?.output_tokens)}</span
              >
            </div>
            <div
              class="info-item"
              style="grid-column: 1 / -1; margin-top: 5px; border-top: 1px solid #eee; padding-top: 5px;"
            >
              <a href="logs">Logs</a> (<a href="download">Download</a>)
            </div>
          </div>

          <!-- SSH Connection Information -->
          ${this.renderSSHSection()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-container-status": SketchContainerStatus;
  }
}
