// sketch-diff-range-picker.ts
// Component for selecting commit range for diffs

import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GitDataService, DefaultGitDataService } from "./git-data-service";
import { GitLogEntry } from "../types";

/**
 * Range type for diff views
 */
export type DiffRange = { type: "range"; from: string; to: string };

/**
 * Component for selecting commit range for diffs
 */
@customElement("sketch-diff-range-picker")
export class SketchDiffRangePicker extends LitElement {
  @property({ type: Array })
  commits: GitLogEntry[] = [];

  @state()
  private fromCommit: string = "";

  @state()
  private toCommit: string = "";

  @state()
  private commitsExpanded: boolean = false;

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
      flex-direction: column;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .commits-header {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .commits-toggle {
      background-color: transparent;
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-color, #333);
    }

    .commits-toggle:hover {
      background-color: var(--background-hover, #e8e8e8);
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
      <div class="commits-header">
        <button
          class="commits-toggle"
          @click="${this.toggleCommitsExpansion}"
          title="${this.commitsExpanded ? 'Hide' : 'Show'} commit range selection"
        >
          ${this.commitsExpanded ? '▼' : '▶'} Commits
        </button>
      </div>
      
      ${this.commitsExpanded
        ? html`
            <div class="commit-selectors">
              ${this.renderRangeSelectors()}
            </div>
          `
        : ''}
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
   * Toggle the expansion of commit selectors
   */
  toggleCommitsExpansion() {
    this.commitsExpanded = !this.commitsExpanded;
  }

  /**
   * Get a summary of the current commit range for display
   */
  getCommitSummary(): string {
    if (!this.fromCommit && !this.toCommit) {
      return 'No commits selected';
    }

    const fromShort = this.fromCommit ? this.fromCommit.substring(0, 7) : '';
    const toShort = this.toCommit ? this.toCommit.substring(0, 7) : 'Uncommitted';
    
    return `${fromShort}..${toShort}`;
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
    const range: DiffRange = { type: "range", from: this.fromCommit, to: this.toCommit };

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

    // Add from parameter if not empty
    if (range.from && range.from.trim() !== "") {
      url.searchParams.set("from", range.from);
    }
    // Add to parameter if not empty (empty string means uncommitted changes)
    if (range.to && range.to.trim() !== "") {
      url.searchParams.set("to", range.to);
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

    // If from or to parameters are present, use them
    if (fromParam || toParam) {
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
