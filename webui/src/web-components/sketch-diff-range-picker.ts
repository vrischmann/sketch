// sketch-diff-range-picker.ts
// Component for selecting commit range for diffs

import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GitDataService, DefaultGitDataService } from "./git-data-service";
import { GitLogEntry } from "../types";

/**
 * Range type for diff views
 */
export type DiffRange =
  | { type: "range"; from: string; to: string }
  | { type: "single"; commit: string };

/**
 * Component for selecting commit range for diffs
 */
@customElement("sketch-diff-range-picker")
export class SketchDiffRangePicker extends LitElement {
  @property({ type: Array })
  commits: GitLogEntry[] = [];

  @state()
  private rangeType: "range" | "single" = "range";

  @state()
  private fromCommit: string = "";

  @state()
  private toCommit: string = "";

  @state()
  private singleCommit: string = "";

  @state()
  private loading: boolean = true;

  @state()
  private error: string | null = null;

  @property({ attribute: false, type: Object })
  gitService!: GitDataService;

  constructor() {
    super();
    console.log("SketchDiffRangePicker initialized");
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: var(--font-family, system-ui, sans-serif);
      color: var(--text-color, #333);
    }

    .range-picker {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background-color: var(--background-light, #f8f8f8);
      border-radius: 4px;
      border: 1px solid var(--border-color, #e0e0e0);
      flex-wrap: wrap; /* Allow wrapping on small screens */
      width: 100%;
      box-sizing: border-box;
    }

    .range-type-selector {
      display: flex;
      gap: 16px;
      flex-shrink: 0;
    }

    .range-type-option {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
    }

    .commit-selectors {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      flex: 1;
      flex-wrap: wrap; /* Allow wrapping on small screens */
    }

    .commit-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 200px;
      max-width: calc(50% - 12px); /* Half width minus half the gap */
      overflow: hidden;
    }

    select {
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color, #e0e0e0);
      background-color: var(--background, #fff);
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    label {
      font-weight: 500;
      font-size: 14px;
    }

    .loading {
      font-style: italic;
      color: var(--text-muted, #666);
    }

    .error {
      color: var(--error-color, #dc3545);
      font-size: 14px;
    }

    .refresh-button {
      padding: 6px 12px;
      background-color: #f0f0f0;
      color: var(--text-color, #333);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .refresh-button:hover {
      background-color: #e0e0e0;
    }

    .refresh-button:disabled {
      background-color: #f8f8f8;
      color: #999;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .commit-selector {
        max-width: 100%;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    // Wait for DOM to be fully loaded to ensure proper initialization order
    if (document.readyState === "complete") {
      this.loadCommits();
    } else {
      window.addEventListener("load", () => {
        setTimeout(() => this.loadCommits(), 0); // Give time for provider initialization
      });
    }

    // Listen for popstate events to handle browser back/forward navigation
    window.addEventListener("popstate", this.handlePopState.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this.handlePopState.bind(this));
  }

  /**
   * Handle browser back/forward navigation
   */
  private handlePopState() {
    // Re-initialize from URL parameters when user navigates
    if (this.commits.length > 0) {
      const initializedFromUrl = this.initializeFromUrlParams();
      if (initializedFromUrl) {
        // Force re-render and dispatch event
        this.requestUpdate();
        this.dispatchRangeEvent();
      }
    }
  }

  render() {
    return html`
      <div class="range-picker">
        ${this.loading
          ? html`<div class="loading">Loading commits...</div>`
          : this.error
            ? html`<div class="error">${this.error}</div>`
            : this.renderRangePicker()}
      </div>
    `;
  }

  renderRangePicker() {
    return html`
      <div class="range-type-selector">
        <label class="range-type-option">
          <input
            type="radio"
            name="rangeType"
            value="range"
            ?checked=${this.rangeType === "range"}
            @change=${() => this.setRangeType("range")}
          />
          Commit Range
        </label>
        <label class="range-type-option">
          <input
            type="radio"
            name="rangeType"
            value="single"
            ?checked=${this.rangeType === "single"}
            @change=${() => this.setRangeType("single")}
          />
          Single Commit
        </label>
      </div>

      <div class="commit-selectors">
        ${this.rangeType === "range"
          ? this.renderRangeSelectors()
          : this.renderSingleSelector()}
      </div>

      <button
        class="refresh-button"
        @click="${this.handleRefresh}"
        ?disabled="${this.loading}"
        title="Refresh commit list"
      >
        🔄 Refresh
      </button>
    `;
  }

  renderRangeSelectors() {
    return html`
      <div class="commit-selector">
        <label for="fromCommit">From:</label>
        <select
          id="fromCommit"
          .value=${this.fromCommit}
          @change=${this.handleFromChange}
        >
          ${this.commits.map(
            (commit) => html`
              <option
                value=${commit.hash}
                ?selected=${commit.hash === this.fromCommit}
              >
                ${this.formatCommitOption(commit)}
              </option>
            `,
          )}
        </select>
      </div>
      <div class="commit-selector">
        <label for="toCommit">To:</label>
        <select
          id="toCommit"
          .value=${this.toCommit}
          @change=${this.handleToChange}
        >
          <option value="" ?selected=${this.toCommit === ""}>
            Uncommitted Changes
          </option>
          ${this.commits.map(
            (commit) => html`
              <option
                value=${commit.hash}
                ?selected=${commit.hash === this.toCommit}
              >
                ${this.formatCommitOption(commit)}
              </option>
            `,
          )}
        </select>
      </div>
    `;
  }

  renderSingleSelector() {
    return html`
      <div class="commit-selector">
        <label for="singleCommit">Commit:</label>
        <select
          id="singleCommit"
          .value=${this.singleCommit}
          @change=${this.handleSingleChange}
        >
          ${this.commits.map(
            (commit) => html`
              <option
                value=${commit.hash}
                ?selected=${commit.hash === this.singleCommit}
              >
                ${this.formatCommitOption(commit)}
              </option>
            `,
          )}
        </select>
      </div>
    `;
  }

  /**
   * Format a commit for display in the dropdown
   */
  formatCommitOption(commit: GitLogEntry): string {
    const shortHash = commit.hash.substring(0, 7);

    // Truncate subject if it's too long
    let subject = commit.subject;
    if (subject.length > 50) {
      subject = subject.substring(0, 47) + "...";
    }

    let label = `${shortHash} ${subject}`;

    // Add refs but keep them concise
    if (commit.refs && commit.refs.length > 0) {
      const refs = commit.refs.map((ref) => {
        // Shorten common prefixes
        if (ref.startsWith("origin/")) {
          return ref.substring(7);
        }
        if (ref.startsWith("refs/heads/")) {
          return ref.substring(11);
        }
        if (ref.startsWith("refs/remotes/origin/")) {
          return ref.substring(20);
        }
        return ref;
      });

      // Limit to first 2 refs to avoid overcrowding
      const displayRefs = refs.slice(0, 2);
      if (refs.length > 2) {
        displayRefs.push(`+${refs.length - 2} more`);
      }

      label += ` (${displayRefs.join(", ")})`;
    }

    return label;
  }

  /**
   * Load commits from the Git data service
   */
  async loadCommits() {
    this.loading = true;
    this.error = null;

    if (!this.gitService) {
      console.error("GitService was not provided to sketch-diff-range-picker");
      throw Error();
    }

    try {
      // Get the base commit reference
      const baseCommitRef = await this.gitService.getBaseCommitRef();

      // Load commit history
      this.commits = await this.gitService.getCommitHistory(baseCommitRef);

      // Check if we should initialize from URL parameters first
      const initializedFromUrl = this.initializeFromUrlParams();

      // Set default selections only if not initialized from URL
      if (this.commits.length > 0 && !initializedFromUrl) {
        // For range, default is base to HEAD
        // TODO: is sketch-base right in the unsafe context, where it's sketch-base-...
        // should this be startswith?
        const baseCommit = this.commits.find(
          (c) => c.refs && c.refs.some((ref) => ref.includes("sketch-base")),
        );

        this.fromCommit = baseCommit
          ? baseCommit.hash
          : this.commits[this.commits.length - 1].hash;
        // Default to Uncommitted Changes by setting toCommit to empty string
        this.toCommit = ""; // Empty string represents uncommitted changes

        // For single, default to HEAD
        this.singleCommit = this.commits[0].hash;
      }

      // Always dispatch range event to ensure diff view is updated
      this.dispatchRangeEvent();
    } catch (error) {
      console.error("Error loading commits:", error);
      this.error = `Error loading commits: ${error.message}`;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Handle range type change
   */
  setRangeType(type: "range" | "single") {
    this.rangeType = type;

    // If switching to range mode and we don't have valid commits set,
    // initialize with sensible defaults
    if (
      type === "range" &&
      (!this.fromCommit || !this.toCommit === undefined)
    ) {
      if (this.commits.length > 0) {
        const baseCommit = this.commits.find(
          (c) => c.refs && c.refs.some((ref) => ref.includes("sketch-base")),
        );
        if (!this.fromCommit) {
          this.fromCommit = baseCommit
            ? baseCommit.hash
            : this.commits[this.commits.length - 1].hash;
        }
        if (this.toCommit === undefined) {
          this.toCommit = ""; // Default to uncommitted changes
        }
      }
    }

    // If switching to single mode and we don't have a valid commit set,
    // initialize with HEAD
    if (type === "single" && !this.singleCommit && this.commits.length > 0) {
      this.singleCommit = this.commits[0].hash;
    }

    this.dispatchRangeEvent();
  }

  /**
   * Handle From commit change
   */
  handleFromChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.fromCommit = select.value;
    this.dispatchRangeEvent();
  }

  /**
   * Handle To commit change
   */
  handleToChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.toCommit = select.value;
    this.dispatchRangeEvent();
  }

  /**
   * Handle Single commit change
   */
  handleSingleChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.singleCommit = select.value;
    this.dispatchRangeEvent();
  }

  /**
   * Handle refresh button click
   */
  handleRefresh() {
    this.loadCommits();
  }

  /**
   * Validate that a commit hash exists in the loaded commits
   */
  private isValidCommitHash(hash: string): boolean {
    if (!hash || hash.trim() === "") return true; // Empty is valid (uncommitted changes)
    return this.commits.some(
      (commit) => commit.hash.startsWith(hash) || commit.hash === hash,
    );
  }

  /**
   * Dispatch range change event and update URL parameters
   */
  dispatchRangeEvent() {
    const range: DiffRange =
      this.rangeType === "range"
        ? { type: "range", from: this.fromCommit, to: this.toCommit }
        : { type: "single", commit: this.singleCommit };

    // Update URL parameters
    this.updateUrlParams(range);

    const event = new CustomEvent("range-change", {
      detail: { range },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
  }

  /**
   * Update URL parameters for from and to commits
   */
  private updateUrlParams(range: DiffRange) {
    const url = new URL(window.location.href);

    // Remove existing range parameters
    url.searchParams.delete("from");
    url.searchParams.delete("to");
    url.searchParams.delete("commit");

    if (range.type === "range") {
      // Add from parameter if not empty
      if (range.from && range.from.trim() !== "") {
        url.searchParams.set("from", range.from);
      }
      // Add to parameter if not empty (empty string means uncommitted changes)
      if (range.to && range.to.trim() !== "") {
        url.searchParams.set("to", range.to);
      }
    } else {
      // Single commit mode
      if (range.commit && range.commit.trim() !== "") {
        url.searchParams.set("commit", range.commit);
      }
    }

    // Update the browser history without reloading the page
    window.history.replaceState(window.history.state, "", url.toString());
  }

  /**
   * Initialize from URL parameters if available
   */
  private initializeFromUrlParams() {
    const url = new URL(window.location.href);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const commitParam = url.searchParams.get("commit");

    // If commit parameter is present, switch to single commit mode
    if (commitParam) {
      this.rangeType = "single";
      this.singleCommit = commitParam;
      return true; // Indicate that we initialized from URL
    }

    // If from or to parameters are present, use range mode
    if (fromParam || toParam) {
      this.rangeType = "range";
      if (fromParam) {
        this.fromCommit = fromParam;
      }
      if (toParam) {
        this.toCommit = toParam;
      } else {
        // If no 'to' param, default to uncommitted changes (empty string)
        this.toCommit = "";
      }
      return true; // Indicate that we initialized from URL
    }

    return false; // No URL params found
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-diff-range-picker": SketchDiffRangePicker;
  }
}
