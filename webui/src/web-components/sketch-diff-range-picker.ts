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
  private dropdownOpen: boolean = false;

  // Removed commitsExpanded state - always expanded now

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

    /* Removed commits-header and commits-label styles - no longer needed */

    .commit-selectors {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .commit-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      position: relative;
    }

    /* Custom dropdown styles */
    .custom-select {
      position: relative;
      width: 100%;
      min-width: 300px;
    }

    .select-button {
      width: 100%;
      padding: 8px 32px 8px 12px;
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 4px;
      background-color: var(--background, #fff);
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      font-family: inherit;
      font-size: 14px;
      position: relative;
    }

    .select-button:hover {
      border-color: var(--border-hover, #ccc);
    }

    .select-button:focus {
      outline: none;
      border-color: var(--accent-color, #007acc);
      box-shadow: 0 0 0 2px var(--accent-color-light, rgba(0, 122, 204, 0.2));
    }

    .select-button.default-commit {
      border-color: var(--accent-color, #007acc);
      background-color: var(--accent-color-light, rgba(0, 122, 204, 0.05));
    }

    .dropdown-arrow {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      transition: transform 0.2s;
    }

    .dropdown-arrow.open {
      transform: translateY(-50%) rotate(180deg);
    }

    .dropdown-content {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background-color: var(--background, #fff);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 4px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      max-height: 300px;
      overflow-y: auto;
      margin-top: 2px;
    }

    .dropdown-option {
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-light, #f0f0f0);
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 14px;
      line-height: 1.4;
      min-height: auto;
    }

    .dropdown-option:last-child {
      border-bottom: none;
    }

    .dropdown-option:hover {
      background-color: var(--background-hover, #f5f5f5);
    }

    .dropdown-option.selected {
      background-color: var(--accent-color-light, rgba(0, 122, 204, 0.1));
    }

    .dropdown-option.default-commit {
      background-color: var(--accent-color-light, rgba(0, 122, 204, 0.05));
      border-left: 3px solid var(--accent-color, #007acc);
      padding-left: 9px;
    }

    .commit-hash {
      font-family: monospace;
      color: var(--text-secondary, #666);
      font-size: 13px;
    }

    .commit-subject {
      color: var(--text-primary, #333);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 200px; /* Ensure commit message gets priority */
    }

    .commit-refs {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .commit-refs-container {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .commit-ref {
      background-color: var(--tag-bg, #e1f5fe);
      color: var(--tag-text, #0277bd);
      padding: 2px 6px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .commit-ref.branch {
      background-color: var(--branch-bg, #e8f5e8);
      color: var(--branch-text, #2e7d32);
    }

    .commit-ref.tag {
      background-color: var(--tag-bg, #fff3e0);
      color: var(--tag-text, #f57c00);
    }

    .commit-ref.sketch-base {
      background-color: var(--accent-color, #007acc);
      color: white;
      font-weight: 600;
    }

    .truncated-refs {
      position: relative;
      cursor: help;
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
      <div class="commit-selectors">${this.renderRangeSelectors()}</div>
    `;
  }

  renderRangeSelectors() {
    // Always diff against uncommitted changes
    this.toCommit = "";

    const selectedCommit = this.commits.find((c) => c.hash === this.fromCommit);
    const isDefaultCommit =
      selectedCommit && this.isSketchBaseCommit(selectedCommit);

    return html`
      <div class="commit-selector">
        <label for="fromCommit">Diff from:</label>
        <div class="custom-select" @click=${this.toggleDropdown}>
          <button
            class="select-button ${isDefaultCommit ? "default-commit" : ""}"
            @click=${this.toggleDropdown}
            @blur=${this.handleBlur}
          >
            ${selectedCommit
              ? this.renderCommitButton(selectedCommit)
              : "Select commit..."}
            <svg
              class="dropdown-arrow ${this.dropdownOpen ? "open" : ""}"
              width="12"
              height="12"
              viewBox="0 0 12 12"
            >
              <path d="M6 8l-4-4h8z" fill="currentColor" />
            </svg>
          </button>
          ${this.dropdownOpen
            ? html`
                <div class="dropdown-content">
                  ${this.commits.map(
                    (commit) => html`
                      <div
                        class="dropdown-option ${commit.hash === this.fromCommit
                          ? "selected"
                          : ""} ${this.isSketchBaseCommit(commit)
                          ? "default-commit"
                          : ""}"
                        @click=${() => this.selectCommit(commit.hash)}
                      >
                        ${this.renderCommitOption(commit)}
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  /**
   * Format a commit for display in the dropdown (legacy method, kept for compatibility)
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
   * Toggle dropdown open/closed
   */
  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;

    if (this.dropdownOpen) {
      // Close dropdown when clicking outside
      setTimeout(() => {
        document.addEventListener("click", this.closeDropdown, { once: true });
      }, 0);
    }
  }

  /**
   * Close dropdown
   */
  closeDropdown = () => {
    this.dropdownOpen = false;
  };

  /**
   * Handle blur event on select button
   */
  handleBlur(event: FocusEvent) {
    // Small delay to allow click events to process
    setTimeout(() => {
      if (!this.shadowRoot?.activeElement?.closest(".custom-select")) {
        this.dropdownOpen = false;
      }
    }, 150);
  }

  /**
   * Select a commit from dropdown
   */
  selectCommit(hash: string) {
    this.fromCommit = hash;
    this.dropdownOpen = false;
    this.dispatchRangeEvent();
  }

  /**
   * Check if a commit is a sketch-base commit
   */
  isSketchBaseCommit(commit: GitLogEntry): boolean {
    return commit.refs?.some((ref) => ref.includes("sketch-base")) || false;
  }

  /**
   * Render commit for the dropdown button
   */
  renderCommitButton(commit: GitLogEntry) {
    const shortHash = commit.hash.substring(0, 7);
    let subject = commit.subject;
    if (subject.length > 40) {
      subject = subject.substring(0, 37) + "...";
    }

    return html`
      <span class="commit-hash">${shortHash}</span>
      <span class="commit-subject">${subject}</span>
      ${this.isSketchBaseCommit(commit)
        ? html` <span class="commit-ref sketch-base">base</span> `
        : ""}
    `;
  }

  /**
   * Render commit option in dropdown
   */
  renderCommitOption(commit: GitLogEntry) {
    const shortHash = commit.hash.substring(0, 7);
    let subject = commit.subject;
    if (subject.length > 50) {
      subject = subject.substring(0, 47) + "...";
    }

    return html`
      <span class="commit-hash">${shortHash}</span>
      <span class="commit-subject">${subject}</span>
      ${commit.refs && commit.refs.length > 0
        ? html` <div class="commit-refs">${this.renderRefs(commit.refs)}</div> `
        : ""}
    `;
  }

  /**
   * Render all refs naturally without truncation
   */
  renderRefs(refs: string[]) {
    return html`
      <div class="commit-refs-container">
        ${refs.map((ref) => {
          const shortRef = this.getShortRefName(ref);
          const isSketchBase = ref.includes("sketch-base");
          const refClass = isSketchBase
            ? "sketch-base"
            : ref.includes("tag")
              ? "tag"
              : "branch";
          return html`<span class="commit-ref ${refClass}">${shortRef}</span>`;
        })}
      </div>
    `;
  }

  /**
   * Get shortened reference name for compact display
   */
  getShortRefName(ref: string): string {
    if (ref.startsWith("refs/heads/")) {
      return ref.substring(11);
    }
    if (ref.startsWith("refs/remotes/origin/")) {
      return ref.substring(20);
    }
    if (ref.startsWith("refs/tags/")) {
      return ref.substring(10);
    }
    return ref;
  }

  /**
   * Get a summary of the current commit range for display
   */
  getCommitSummary(): string {
    if (!this.fromCommit && !this.toCommit) {
      return "No commits selected";
    }

    const fromShort = this.fromCommit ? this.fromCommit.substring(0, 7) : "";
    const toShort = this.toCommit
      ? this.toCommit.substring(0, 7)
      : "Uncommitted";

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
    const range: DiffRange = {
      type: "range",
      from: this.fromCommit,
      to: this.toCommit,
    };

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
