/* eslint-disable @typescript-eslint/no-explicit-any */
import { html, render } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property, state } from "lit/decorators.js";
import { AgentMessage, State } from "../types";
import { marked, MarkedOptions, Renderer, Tokens } from "marked";
import type mermaid from "mermaid";
import DOMPurify from "dompurify";

// Mermaid is loaded dynamically - see loadMermaid() function
declare global {
  interface Window {
    mermaid?: typeof mermaid;
  }
}

// Mermaid hash will be injected at build time
declare const __MERMAID_HASH__: string;

// Load Mermaid dynamically
let mermaidLoadPromise: Promise<any> | null = null;

function loadMermaid(): Promise<typeof mermaid> {
  if (mermaidLoadPromise) {
    return mermaidLoadPromise;
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }

  mermaidLoadPromise = new Promise((resolve, reject) => {
    // Get the Mermaid hash from build-time constant
    const mermaidHash = __MERMAID_HASH__;

    // Try to load the external Mermaid bundle
    const script = document.createElement("script");
    script.onload = () => {
      // The Mermaid bundle should set window.mermaid
      if (window.mermaid) {
        resolve(window.mermaid);
      } else {
        reject(new Error("Mermaid not loaded from external bundle"));
      }
    };
    script.onerror = (error) => {
      console.warn("Failed to load external Mermaid bundle:", error);
      reject(new Error("Mermaid external bundle failed to load"));
    };

    // Don't set type="module" since we're using IIFE format
    script.src = `./static/mermaid-standalone-${mermaidHash}.js`;
    document.head.appendChild(script);
  });

  return mermaidLoadPromise;
}
import "./sketch-tool-calls";
import { SketchTailwindElement } from "./sketch-tailwind-element";

@customElement("sketch-timeline-message")
export class SketchTimelineMessage extends SketchTailwindElement {
  @property()
  message: AgentMessage;

  @property()
  state: State;

  @property()
  previousMessage: AgentMessage;

  @property()
  open: boolean = false;

  @property()
  firstMessageIndex: number = 0;

  @property({ type: Boolean, reflect: true, attribute: "compactpadding" })
  compactPadding: boolean = false;

  @state()
  showInfo: boolean = false;

  // Styles have been converted to Tailwind classes applied directly to HTML elements
  // since this component now extends SketchTailwindElement which disables shadow DOM

  // Track mermaid diagrams that need rendering
  private mermaidDiagrams = new Map();

  constructor() {
    super();
    // Mermaid will be initialized lazily when first needed
  }

  // See https://lit.dev/docs/components/lifecycle/
  connectedCallback() {
    super.connectedCallback();
    this.ensureGlobalStyles();
  }

  // Ensure global styles are injected when component is used
  private ensureGlobalStyles() {
    if (!document.querySelector("#sketch-timeline-message-styles")) {
      const floatingMessageStyles = document.createElement("style");
      floatingMessageStyles.id = "sketch-timeline-message-styles";
      floatingMessageStyles.textContent = this.getGlobalStylesContent();
      document.head.appendChild(floatingMessageStyles);
    }
  }

  // Get the global styles content
  private getGlobalStylesContent(): string {
    return `
  .floating-message {
    background-color: rgba(31, 41, 55, 1);
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    pointer-events: none;
    transition: all 0.3s ease;
  }

  .floating-message.success {
    background-color: rgba(34, 197, 94, 0.9);
  }

  .floating-message.error {
    background-color: rgba(239, 68, 68, 0.9);
  }

  /* Comprehensive markdown content styling */
  .markdown-content h1 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 1rem 0 0.5rem 0;
    line-height: 1.25;
  }

  .markdown-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0.875rem 0 0.5rem 0;
    line-height: 1.25;
  }

  .markdown-content h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0.75rem 0 0.375rem 0;
    line-height: 1.375;
  }

  .markdown-content h4 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0.625rem 0 0.375rem 0;
    line-height: 1.375;
  }

  .markdown-content h5 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0.5rem 0 0.25rem 0;
    line-height: 1.5;
  }

  .markdown-content h6 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0.5rem 0 0.25rem 0;
    line-height: 1.5;
  }

  .markdown-content h1:first-child,
  .markdown-content h2:first-child,
  .markdown-content h3:first-child,
  .markdown-content h4:first-child,
  .markdown-content h5:first-child,
  .markdown-content h6:first-child {
    margin-top: 0;
  }

  .markdown-content p {
    margin: 0.25rem 0;
  }

  .markdown-content p:first-child {
    margin-top: 0;
  }

  .markdown-content p:last-child {
    margin-bottom: 0;
  }

  .markdown-content a {
    color: inherit;
    text-decoration: underline;
  }

  .markdown-content ul,
  .markdown-content ol {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }

  .markdown-content ul {
    list-style-type: disc;
  }

  .markdown-content ol {
    list-style-type: decimal;
  }

  .markdown-content li {
    margin: 0.25rem 0;
  }

  .markdown-content blockquote {
    border-left: 3px solid rgba(0, 0, 0, 0.2);
    padding-left: 1rem;
    margin-left: 0.5rem;
    font-style: italic;
    color: rgba(0, 0, 0, 0.7);
  }

  .markdown-content strong {
    font-weight: 700;
  }

  .markdown-content em {
    font-style: italic;
  }

  .markdown-content hr {
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    margin: 1rem 0;
  }

  /* User message specific markdown styling */
  sketch-timeline-message .bg-blue-500 .markdown-content a {
    color: #fff;
    text-decoration: underline;
  }

  sketch-timeline-message .bg-blue-500 .markdown-content blockquote {
    border-left: 3px solid rgba(255, 255, 255, 0.4);
    color: rgba(255, 255, 255, 0.9);
  }

  sketch-timeline-message .bg-blue-500 .markdown-content hr {
    border-top: 1px solid rgba(255, 255, 255, 0.3);
  }

  /* Code block styling within markdown */
  .markdown-content pre,
  .markdown-content code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    padding: 2px 4px;
    overflow-x: auto;
    max-width: 100%;
    word-break: break-all;
    box-sizing: border-box;
  }

  .markdown-content pre {
    padding: 8px 12px;
    margin: 0.5rem 0;
    line-height: 1.4;
  }

  .markdown-content pre code {
    background: transparent;
    padding: 0;
  }

  /* User message code styling */
  sketch-timeline-message .bg-blue-500 .markdown-content pre,
  sketch-timeline-message .bg-blue-500 .markdown-content code {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  sketch-timeline-message .bg-blue-500 .markdown-content pre code {
    background: transparent;
  }

  /* Code block containers */
  .code-block-container {
    position: relative;
    margin: 8px 0;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.05);
  }

  sketch-timeline-message .bg-blue-500 .code-block-container {
    background: rgba(255, 255, 255, 0.2);
  }

  .code-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.1);
    font-size: 12px;
  }

  sketch-timeline-message .bg-blue-500 .code-block-header {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .code-language {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 11px;
    font-weight: 500;
  }

  .code-copy-button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: all 0.15s ease;
  }

  .code-copy-button:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }

  sketch-timeline-message .bg-blue-500 .code-copy-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .code-block-container pre {
    margin: 0;
    padding: 8px;
    background: transparent;
  }

  .code-block-container code {
    background: transparent;
    padding: 0;
    display: block;
    width: 100%;
  }

  /* Mermaid diagram styling */
  .mermaid-container {
    margin: 1rem 0;
    padding: 0.5rem;
    background-color: #f8f8f8;
    border-radius: 4px;
    overflow-x: auto;
  }

  .mermaid {
    text-align: center;
  }

  /* Print styles */
  @media print {
    .floating-message,
    .commit-diff-button,
    button[title="Copy to clipboard"],
    button[title="Show message details"] {
      display: none !important;
    }
  }
`;
  }

  // After the component is updated and rendered, render any mermaid diagrams
  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    this.renderMermaidDiagrams();
    this.setupCodeBlockCopyButtons();
  }

  // Render mermaid diagrams after the component is updated
  renderMermaidDiagrams() {
    // Add a small delay to ensure the DOM is fully rendered
    setTimeout(async () => {
      // Find all mermaid containers in our shadow root
      const containers = this.querySelectorAll(".mermaid");
      if (!containers || containers.length === 0) return;

      try {
        // Load mermaid dynamically
        const mermaidLib = await loadMermaid();

        // Initialize mermaid with specific config (only once per load)
        mermaidLib.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: "default",
          securityLevel: "loose", // Allows more flexibility but be careful with user-generated content
          fontFamily: "monospace",
        });

        // Process each mermaid diagram
        containers.forEach((container) => {
          const id = container.id;
          const code = container.textContent || "";
          if (!code || !id) return; // Use return for forEach instead of continue

          try {
            // Clear any previous content
            container.innerHTML = code;

            // Render the mermaid diagram using promise
            mermaidLib
              .render(`${id}-svg`, code)
              .then(({ svg }) => {
                container.innerHTML = svg;
              })
              .catch((err) => {
                console.error("Error rendering mermaid diagram:", err);
                // Show the original code as fallback
                container.innerHTML = `<pre>${code}</pre>`;
              });
          } catch (err) {
            console.error("Error processing mermaid diagram:", err);
            // Show the original code as fallback
            container.innerHTML = `<pre>${code}</pre>`;
          }
        });
      } catch (err) {
        console.error("Error loading mermaid:", err);
        // Show the original code as fallback for all diagrams
        containers.forEach((container) => {
          const code = container.textContent || "";
          container.innerHTML = `<pre>${code}</pre>`;
        });
      }
    }, 100); // Small delay to ensure DOM is ready
  }

  // Setup code block copy buttons after component is updated
  setupCodeBlockCopyButtons() {
    setTimeout(() => {
      // Find all copy buttons in code blocks
      const copyButtons = this.querySelectorAll(".code-copy-button");
      if (!copyButtons || copyButtons.length === 0) return;

      // Add click event listener to each button
      copyButtons.forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const codeId = (button as HTMLElement).dataset.codeId;
          if (!codeId) return;

          const codeElement = this.querySelector(`#${codeId}`);
          if (!codeElement) return;

          const codeText = codeElement.textContent || "";
          const buttonRect = button.getBoundingClientRect();

          // Copy code to clipboard
          navigator.clipboard
            .writeText(codeText)
            .then(() => {
              // Show success indicator
              const originalHTML = button.innerHTML;
              button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
              `;

              // Display floating message
              this.showFloatingMessage("Copied!", buttonRect, "success");

              // Reset button after delay
              setTimeout(() => {
                button.innerHTML = originalHTML;
              }, 2000);
            })
            .catch((err) => {
              console.error("Failed to copy code:", err);
              this.showFloatingMessage("Failed to copy!", buttonRect, "error");
            });
        });
      });
    }, 100); // Small delay to ensure DOM is ready
  }

  // See https://lit.dev/docs/components/lifecycle/
  disconnectedCallback() {
    super.disconnectedCallback();
  }

  renderMarkdown(markdownContent: string): string {
    try {
      // Create a custom renderer
      const renderer = new Renderer();
      const originalCodeRenderer = renderer.code.bind(renderer);

      // Override the code renderer to handle mermaid diagrams and add copy buttons
      renderer.code = function ({ text, lang, escaped }: Tokens.Code): string {
        if (lang === "mermaid") {
          // Generate a unique ID for this diagram
          const id = `mermaid-diagram-${Math.random().toString(36).substring(2, 10)}`;

          // Just create the container and mermaid div - we'll render it in the updated() lifecycle method
          return `<div class="mermaid-container">
                   <div class="mermaid" id="${id}">${text}</div>
                 </div>`;
        }

        // For regular code blocks, call the original renderer to get properly escaped HTML
        const originalCodeHtml = originalCodeRenderer({ text, lang, escaped });

        // Extract the code content from the original HTML to add our custom wrapper
        // The original renderer returns: <pre><code class="language-x">escapedText</code></pre>
        const codeMatch = originalCodeHtml.match(
          /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
        );
        if (!codeMatch) {
          // Fallback to original if we can't parse it
          return originalCodeHtml;
        }

        const escapedText = codeMatch[1];
        const id = `code-block-${Math.random().toString(36).substring(2, 10)}`;
        const langClass = lang ? ` class="language-${lang}"` : "";

        return `<div class="code-block-container">
                 <div class="code-block-header">
                   ${lang ? `<span class="code-language">${lang}</span>` : ""}
                   <button class="code-copy-button" title="Copy code" data-code-id="${id}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                     </svg>
                   </button>
                 </div>
                 <pre><code id="${id}"${langClass}>${escapedText}</code></pre>
               </div>`;
      };

      // Set markdown options for proper code block highlighting
      const markedOptions: MarkedOptions = {
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // Convert newlines to <br>
        async: false,
        renderer: renderer,
      };

      // Parse markdown and sanitize the output HTML with DOMPurify
      const htmlOutput = marked.parse(markdownContent, markedOptions) as string;
      return DOMPurify.sanitize(htmlOutput, {
        // Allow common HTML elements that are safe
        ALLOWED_TAGS: [
          "p",
          "br",
          "strong",
          "em",
          "b",
          "i",
          "u",
          "s",
          "code",
          "pre",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "li",
          "blockquote",
          "a",
          "div",
          "span", // For mermaid diagrams and code blocks
          "svg",
          "g",
          "path",
          "rect",
          "circle",
          "text",
          "line",
          "polygon", // For mermaid SVG
          "button", // For code copy buttons
        ],
        ALLOWED_ATTR: [
          "href",
          "title",
          "target",
          "rel", // For links
          "class",
          "id", // For styling and functionality
          "data-*", // For code copy buttons
          // SVG attributes for mermaid diagrams
          "viewBox",
          "width",
          "height",
          "xmlns",
          "fill",
          "stroke",
          "stroke-width",
          "d",
          "x",
          "y",
          "x1",
          "y1",
          "x2",
          "y2",
          "cx",
          "cy",
          "r",
          "rx",
          "ry",
          "points",
          "transform",
          "text-anchor",
          "font-size",
          "font-family",
        ],
        // Allow data attributes for functionality
        ALLOW_DATA_ATTR: true,
        // Keep whitespace for code formatting
        KEEP_CONTENT: true,
      });
    } catch (error) {
      console.error("Error rendering markdown:", error);
      // Fallback to sanitized plain text if markdown parsing fails
      return DOMPurify.sanitize(markdownContent);
    }
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(
    timestamp: string | number | Date | null | undefined,
    defaultValue: string = "",
  ): string {
    if (!timestamp) return defaultValue;
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return defaultValue;

      // Format: Mar 13, 2025 09:53:25 AM
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return defaultValue;
    }
  }

  formatNumber(
    num: number | null | undefined,
    defaultValue: string = "0",
  ): string {
    if (num === undefined || num === null) return defaultValue;
    try {
      return num.toLocaleString();
    } catch {
      return String(num);
    }
  }
  formatCurrency(
    num: number | string | null | undefined,
    defaultValue: string = "$0.00",
    isMessageLevel: boolean = false,
  ): string {
    if (num === undefined || num === null) return defaultValue;
    try {
      // Use 4 decimal places for message-level costs, 2 for totals
      const decimalPlaces = isMessageLevel ? 4 : 2;
      return `$${parseFloat(String(num)).toFixed(decimalPlaces)}`;
    } catch {
      return defaultValue;
    }
  }

  // Format duration from nanoseconds to a human-readable string
  _formatDuration(nanoseconds: number | null | undefined): string {
    if (!nanoseconds) return "0s";

    const seconds = nanoseconds / 1e9;

    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}min ${remainingSeconds.toFixed(0)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingSeconds = seconds % 3600;
      const minutes = Math.floor(remainingSeconds / 60);
      return `${hours}h ${minutes}min`;
    }
  }

  showCommit(commitHash: string) {
    this.dispatchEvent(
      new CustomEvent("show-commit-diff", {
        bubbles: true,
        composed: true,
        detail: { commitHash },
      }),
    );
  }

  _toggleInfo(e: Event) {
    e.stopPropagation();
    this.showInfo = !this.showInfo;
  }

  copyToClipboard(text: string, event: Event) {
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.showFloatingMessage("Copied!", rect, "success");
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        this.showFloatingMessage("Failed to copy!", rect, "error");
      });
  }

  showFloatingMessage(
    message: string,
    targetRect: DOMRect,
    type: "success" | "error",
  ) {
    // Create floating message element
    const floatingMsg = document.createElement("div");
    floatingMsg.textContent = message;
    floatingMsg.className = `floating-message ${type}`;

    // Position it near the clicked element
    // Position just above the element
    const top = targetRect.top - 30;
    const left = targetRect.left + targetRect.width / 2 - 40;

    floatingMsg.style.position = "fixed";
    floatingMsg.style.top = `${top}px`;
    floatingMsg.style.left = `${left}px`;
    floatingMsg.style.zIndex = "9999";

    // Add to document body
    document.body.appendChild(floatingMsg);

    // Animate in
    floatingMsg.style.opacity = "0";
    floatingMsg.style.transform = "translateY(10px)";

    setTimeout(() => {
      floatingMsg.style.opacity = "1";
      floatingMsg.style.transform = "translateY(0)";
    }, 10);

    // Remove after animation
    setTimeout(() => {
      floatingMsg.style.opacity = "0";
      floatingMsg.style.transform = "translateY(-10px)";

      setTimeout(() => {
        document.body.removeChild(floatingMsg);
      }, 300);
    }, 1500);
  }

  // Format GitHub repository URL to org/repo format
  formatGitHubRepo(url) {
    if (!url) return null;

    // Common GitHub URL patterns
    const patterns = [
      // HTTPS URLs
      /https:\/\/github\.com\/([^/]+)\/([^/\s.]+)(?:\.git)?/,
      // SSH URLs
      /git@github\.com:([^/]+)\/([^/\s.]+)(?:\.git)?/,
      // Git protocol
      /git:\/\/github\.com\/([^/]+)\/([^/\s.]+)(?:\.git)?/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          formatted: `${match[1]}/${match[2]}`,
          url: `https://github.com/${match[1]}/${match[2]}`,
          owner: match[1],
          repo: match[2],
        };
      }
    }

    return null;
  }

  // Generate GitHub branch URL if linking is enabled
  getGitHubBranchLink(branchName) {
    if (!this.state?.link_to_github || !branchName) {
      return null;
    }

    const github = this.formatGitHubRepo(this.state?.git_origin);
    if (!github) {
      return null;
    }

    return `https://github.com/${github.owner}/${github.repo}/tree/${branchName}`;
  }

  render() {
    // Calculate if this is an end of turn message with no parent conversation ID
    const isEndOfTurn =
      this.message?.end_of_turn && !this.message?.parent_conversation_id;

    const isPreCompaction =
      this.message?.idx !== undefined &&
      this.message.idx < this.firstMessageIndex;

    // Dynamic classes based on message type and state
    const messageClasses = [
      "relative mb-1.5 flex flex-col w-full", // base message styles
      isEndOfTurn ? "mb-4" : "", // end-of-turn spacing
      isPreCompaction ? "opacity-85 border-l-2 border-gray-300" : "", // pre-compaction styling
    ]
      .filter(Boolean)
      .join(" ");

    const bubbleContainerClasses = [
      "flex-1 flex overflow-hidden text-ellipsis",
      this.compactPadding ? "max-w-full" : "max-w-[calc(100%-160px)]",
      this.message?.type === "user" ? "justify-end" : "justify-start",
    ]
      .filter(Boolean)
      .join(" ");

    const messageContentClasses = [
      "relative px-2.5 py-1.5 rounded-xl shadow-sm max-w-full w-fit min-w-min break-words word-break-words",
      // User message styling
      this.message?.type === "user"
        ? "bg-blue-500 text-white rounded-br-sm"
        : // Agent/tool/error message styling
          "bg-gray-100 text-black rounded-bl-sm",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div class="${messageClasses}">
        <div class="flex relative w-full">
          <!-- Left metadata area -->
          <div
            class="${this.compactPadding
              ? "hidden"
              : "flex-none w-20 px-1 py-0.5 text-right text-xs text-gray-500 self-start"}"
          ></div>

          <!-- Message bubble -->
          <div class="${bubbleContainerClasses}">
            <div class="${messageContentClasses}">
              <div class="relative">
                <div
                  class="absolute top-1 right-1 z-10 opacity-0 hover:opacity-100 transition-opacity duration-200 flex gap-1.5"
                >
                  ${copyButton(this.message?.content)}
                  <button
                    class="bg-transparent border-none ${this.message?.type ===
                    "user"
                      ? "text-white/80 hover:bg-white/15"
                      : "text-black/60 hover:bg-black/8"} cursor-pointer p-0.5 rounded-full flex items-center justify-center w-6 h-6 transition-all duration-150"
                    title="Show message details"
                    @click=${this._toggleInfo}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </button>
                </div>
                ${this.message?.content
                  ? html`
                      <div
                        class="overflow-x-auto mb-0 font-sans py-0.5 select-text cursor-text text-sm leading-relaxed text-left min-w-[200px] box-border mx-auto markdown-content"
                      >
                        ${unsafeHTML(
                          this.renderMarkdown(this.message?.content),
                        )}
                      </div>
                    `
                  : ""}

                <!-- End of turn indicator inside the bubble -->
                ${isEndOfTurn && this.message?.elapsed
                  ? html`
                      <div
                        class="block text-xs ${this.message?.type === "user"
                          ? "text-white/70"
                          : "text-gray-500"} py-0.5 mt-2 text-right italic"
                      >
                        end of turn
                        (${this._formatDuration(this.message?.elapsed)})
                      </div>
                    `
                  : ""}

                <!-- Info panel that can be toggled -->
                ${this.showInfo
                  ? html`
                      <div
                        class="mt-2 p-2 ${this.message?.type === "user"
                          ? "bg-white/15 border-l-2 border-white/20"
                          : "bg-black/5 border-l-2 border-black/10"} rounded-md text-xs transition-all duration-200"
                      >
                        <div class="mb-1 flex">
                          <span class="font-bold mr-1 min-w-[60px]">Type:</span>
                          <span class="flex-1">${this.message?.type}</span>
                        </div>
                        <div class="mb-1 flex">
                          <span class="font-bold mr-1 min-w-[60px]">Time:</span>
                          <span class="flex-1">
                            ${this.formatTimestamp(this.message?.timestamp, "")}
                          </span>
                        </div>
                        ${this.message?.elapsed
                          ? html`
                              <div class="mb-1 flex">
                                <span class="font-bold mr-1 min-w-[60px]"
                                  >Duration:</span
                                >
                                <span class="flex-1">
                                  ${this._formatDuration(this.message?.elapsed)}
                                </span>
                              </div>
                            `
                          : ""}
                        ${this.message?.usage
                          ? html`
                              <div class="mb-1 flex">
                                <span class="font-bold mr-1 min-w-[60px]"
                                  >Tokens:</span
                                >
                                <span class="flex-1">
                                  ${this.message?.usage
                                    ? html`
                                        <div>
                                          Input:
                                          ${this.formatNumber(
                                            this.message?.usage?.input_tokens ||
                                              0,
                                          )}
                                        </div>
                                        ${this.message?.usage
                                          ?.cache_creation_input_tokens
                                          ? html`
                                              <div>
                                                Cache creation:
                                                ${this.formatNumber(
                                                  this.message?.usage
                                                    ?.cache_creation_input_tokens,
                                                )}
                                              </div>
                                            `
                                          : ""}
                                        ${this.message?.usage
                                          ?.cache_read_input_tokens
                                          ? html`
                                              <div>
                                                Cache read:
                                                ${this.formatNumber(
                                                  this.message?.usage
                                                    ?.cache_read_input_tokens,
                                                )}
                                              </div>
                                            `
                                          : ""}
                                        <div>
                                          Output:
                                          ${this.formatNumber(
                                            this.message?.usage?.output_tokens,
                                          )}
                                        </div>
                                        <div>
                                          Cost:
                                          ${this.formatCurrency(
                                            this.message?.usage?.cost_usd,
                                          )}
                                        </div>
                                      `
                                    : "N/A"}
                                </span>
                              </div>
                            `
                          : ""}
                        ${this.message?.conversation_id
                          ? html`
                              <div class="mb-1 flex">
                                <span class="font-bold mr-1 min-w-[60px]"
                                  >Conversation ID:</span
                                >
                                <span
                                  class="flex-1 font-mono text-xs break-all"
                                >
                                  ${this.message?.conversation_id}
                                </span>
                              </div>
                            `
                          : ""}
                      </div>
                    `
                  : ""}
              </div>

              <!-- Tool calls - only shown for agent messages -->
              ${this.message?.type === "agent"
                ? html`
                    <sketch-tool-calls
                      .toolCalls=${this.message?.tool_calls}
                      .open=${this.open}
                    ></sketch-tool-calls>
                  `
                : ""}

              <!-- Commits section -->
              ${this.message?.commits
                ? html`
                    <div class="mt-2.5">
                      <div
                        class="bg-green-100 text-green-800 font-medium text-xs py-1.5 px-2.5 rounded-2xl mb-2 text-center shadow-sm"
                      >
                        ${this.message.commits.length} new
                        commit${this.message.commits.length > 1 ? "s" : ""}
                        detected
                      </div>
                      ${this.message.commits.map((commit) => {
                        return html`
                          <div
                            class="text-sm bg-gray-100 rounded-lg overflow-hidden mb-1.5 shadow-sm p-1.5 px-2 flex items-center gap-2"
                          >
                            <span
                              class="text-blue-600 font-bold font-mono cursor-pointer no-underline bg-blue-600/10 py-0.5 px-1 rounded hover:bg-blue-600/20"
                              title="Click to copy: ${commit.hash}"
                              @click=${(e) =>
                                this.copyToClipboard(
                                  commit.hash.substring(0, 8),
                                  e,
                                )}
                            >
                              ${commit.hash.substring(0, 8)}
                            </span>
                            ${commit.pushed_branch
                              ? (() => {
                                  const githubLink = this.getGitHubBranchLink(
                                    commit.pushed_branch,
                                  );
                                  return html`
                                    <div class="flex items-center gap-1.5">
                                      <span
                                        class="text-green-600 font-medium cursor-pointer font-mono bg-green-600/10 py-0.5 px-1 rounded hover:bg-green-600/20"
                                        title="Click to copy: ${commit.pushed_branch}"
                                        @click=${(e) =>
                                          this.copyToClipboard(
                                            commit.pushed_branch,
                                            e,
                                          )}
                                        >${commit.pushed_branch}</span
                                      >
                                      <span
                                        class="opacity-70 flex items-center hover:opacity-100"
                                        @click=${(e) => {
                                          e.stopPropagation();
                                          this.copyToClipboard(
                                            commit.pushed_branch,
                                            e,
                                          );
                                        }}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="2"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                          class="align-middle"
                                        >
                                          <rect
                                            x="9"
                                            y="9"
                                            width="13"
                                            height="13"
                                            rx="2"
                                            ry="2"
                                          ></rect>
                                          <path
                                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                          ></path>
                                        </svg>
                                      </span>
                                      ${githubLink
                                        ? html`
                                            <a
                                              href="${githubLink}"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              class="text-gray-600 no-underline flex items-center transition-colors duration-200 hover:text-blue-600"
                                              title="Open ${commit.pushed_branch} on GitHub"
                                              @click=${(e) =>
                                                e.stopPropagation()}
                                            >
                                              <svg
                                                class="w-3.5 h-3.5"
                                                viewBox="0 0 16 16"
                                                width="14"
                                                height="14"
                                              >
                                                <path
                                                  fill="currentColor"
                                                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                                                />
                                              </svg>
                                            </a>
                                          `
                                        : ""}
                                    </div>
                                  `;
                                })()
                              : ``}
                            <span
                              class="text-sm text-gray-700 flex-grow truncate"
                            >
                              ${commit.subject}
                            </span>
                            <button
                              class="py-0.5 px-2 border-0 rounded bg-blue-600 text-white text-xs cursor-pointer transition-all duration-200 block ml-auto hover:bg-blue-700"
                              @click=${() => this.showCommit(commit.hash)}
                            >
                              View Diff
                            </button>
                          </div>
                        `;
                      })}
                    </div>
                  `
                : ""}
            </div>
          </div>

          <!-- Right metadata area -->
          <div
            class="${this.compactPadding
              ? "hidden"
              : "flex-none w-20 px-1 py-0.5 text-left text-xs text-gray-500 self-start"}"
          ></div>
        </div>

        <!-- User name for user messages - positioned outside and below the bubble -->
        ${this.message?.type === "user" && this.state?.git_username
          ? html`
              <div
                class="flex justify-end mt-1 ${this.compactPadding
                  ? ""
                  : "pr-20"}"
              >
                <div class="text-xs text-gray-600 italic text-right">
                  ${this.state.git_username}
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

function copyButton(textToCopy: string) {
  // SVG for copy icon (two overlapping rectangles)
  const copyIcon = html`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>`;

  // SVG for success check mark
  const successIcon = html`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 6L9 17l-5-5"></path>
  </svg>`;

  const ret = html`<button
    class="bg-transparent border-none cursor-pointer p-0.5 rounded-full flex items-center justify-center w-6 h-6 transition-all duration-150"
    title="Copy to clipboard"
    @click=${(e: Event) => {
      e.stopPropagation();
      const copyButton = e.currentTarget as HTMLButtonElement;
      const originalInnerHTML = copyButton.innerHTML;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          copyButton.innerHTML = "";
          const successElement = document.createElement("div");
          copyButton.appendChild(successElement);
          render(successIcon, successElement);
          setTimeout(() => {
            copyButton.innerHTML = originalInnerHTML;
          }, 2000);
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          setTimeout(() => {
            copyButton.innerHTML = originalInnerHTML;
          }, 2000);
        });
    }}
  >
    ${copyIcon}
  </button>`;

  return ret;
}

// Global styles are now injected in the component's connectedCallback() method
// to ensure they are added when the component is actually used, not at module load time

declare global {
  interface HTMLElementTagNameMap {
    "sketch-timeline-message": SketchTimelineMessage;
  }
}
