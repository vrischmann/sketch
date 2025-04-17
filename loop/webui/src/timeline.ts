import { TimelineMessage } from "./timeline/types";
import { formatNumber } from "./timeline/utils";
import { checkShouldScroll } from "./timeline/scroll";
import { ChartManager } from "./timeline/charts";
import { ConnectionStatus, DataManager } from "./timeline/data";
import { DiffViewer } from "./timeline/diffviewer";
import { MessageRenderer } from "./timeline/renderer";
import { TerminalHandler } from "./timeline/terminal";

/**
 * TimelineManager - Class to manage the timeline UI and functionality
 */
class TimelineManager {
  private diffViewer = new DiffViewer();
  private terminalHandler = new TerminalHandler();
  private chartManager = new ChartManager();
  private messageRenderer = new MessageRenderer();
  private dataManager = new DataManager();

  private viewMode: "chat" | "diff2" | "charts" | "terminal" = "chat";
  shouldScrollToBottom: boolean;

  constructor() {
    // Initialize when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
      // First initialize from URL params to prevent flash of incorrect view
      // This must happen before setting up other event handlers
      void this.initializeViewFromUrl()
        .then(() => {
          // Continue with the rest of initialization
          return this.initialize();
        })
        .catch((err) => {
          console.error("Failed to initialize timeline:", err);
        });
    });

    // Add popstate event listener to handle browser back/forward navigation
    window.addEventListener("popstate", (event) => {
      if (event.state && event.state.mode) {
        // Using void to handle the promise returned by toggleViewMode
        void this.toggleViewMode(event.state.mode);
      } else {
        // If no state or no mode in state, default to chat view
        void this.toggleViewMode("chat");
      }
    });

    // Listen for commit diff event from MessageRenderer
    document.addEventListener("showCommitDiff", ((e: CustomEvent) => {
      const { commitHash } = e.detail;
      this.diffViewer.showCommitDiff(
        commitHash,
        (mode: "chat" | "diff2" | "terminal" | "charts") =>
          this.toggleViewMode(mode)
      );
    }) as EventListener);
  }

  /**
   * Initialize the timeline manager
   */
  private async initialize(): Promise<void> {
    // Set up data manager event listeners
    this.dataManager.addEventListener(
      "dataChanged",
      this.handleDataChanged.bind(this)
    );
    this.dataManager.addEventListener(
      "connectionStatusChanged",
      this.handleConnectionStatusChanged.bind(this)
    );

    // Initialize the data manager
    await this.dataManager.initialize();

    // URL parameters have already been read in constructor
    // to prevent flash of incorrect content

    // Set up conversation button handler
    document
      .getElementById("showConversationButton")
      ?.addEventListener("click", async () => {
        this.toggleViewMode("chat");
      });

    // Set up diff2 button handler
    document
      .getElementById("showDiff2Button")
      ?.addEventListener("click", async () => {
        this.toggleViewMode("diff2");
      });

    // Set up charts button handler
    document
      .getElementById("showChartsButton")
      ?.addEventListener("click", async () => {
        this.toggleViewMode("charts");
      });

    // Set up terminal button handler
    document
      .getElementById("showTerminalButton")
      ?.addEventListener("click", async () => {
        this.toggleViewMode("terminal");
      });

    // The active button will be set by toggleViewMode
    // We'll initialize view based on URL params or default to chat view if no params
    // We defer button activation to the toggleViewMode function

    // Set up stop button handler
    document
      .getElementById("stopButton")
      ?.addEventListener("click", async () => {
        this.stopInnerLoop();
      });

    const pollToggleCheckbox = document.getElementById(
      "pollToggle"
    ) as HTMLInputElement;
    pollToggleCheckbox?.addEventListener("change", () => {
      this.dataManager.setPollingEnabled(pollToggleCheckbox.checked);
      const statusText = document.getElementById("statusText");
      if (statusText) {
        if (pollToggleCheckbox.checked) {
          statusText.textContent = "Polling for updates...";
        } else {
          statusText.textContent = "Polling stopped";
        }
      }
    });

    // Initial data fetch and polling is now handled by the DataManager

    // Set up chat functionality
    this.setupChatBox();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Set up spacing adjustments
    this.adjustChatSpacing();
    window.addEventListener("resize", () => this.adjustChatSpacing());
  }

  /**
   * Set up chat box event listeners
   */
  private setupChatBox(): void {
    const chatInput = document.getElementById(
      "chatInput"
    ) as HTMLTextAreaElement;
    const sendButton = document.getElementById("sendChatButton");

    // Handle pressing Enter in the text area
    chatInput?.addEventListener("keydown", (event: KeyboardEvent) => {
      // Send message if Enter is pressed without Shift key
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // Prevent default newline
        this.sendChatMessage();
      }
    });

    // Handle send button click
    sendButton?.addEventListener("click", () => this.sendChatMessage());

    // Set up mutation observer for the chat container
    if (chatInput) {
      chatInput.addEventListener("input", () => {
        // When content changes, adjust the spacing
        requestAnimationFrame(() => this.adjustChatSpacing());
      });
    }
  }

  /**
   * Send the chat message to the server
   */
  private async sendChatMessage(): Promise<void> {
    const chatInput = document.getElementById(
      "chatInput"
    ) as HTMLTextAreaElement;
    if (!chatInput) return;

    const message = chatInput.value.trim();

    // Don't send empty messages
    if (!message) return;

    try {
      // Send the message to the server
      const response = await fetch("chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }

      // Clear the input after sending
      chatInput.value = "";

      // Reset data manager state to force a full refresh after sending a message
      // This ensures we get all messages in the correct order
      // Use private API for now - TODO: add a resetState() method to DataManager
      (this.dataManager as any).nextFetchIndex = 0;
      (this.dataManager as any).currentFetchStartIndex = 0;

      // If in diff view, switch to conversation view
      if (this.viewMode === "diff2") {
        await this.toggleViewMode("chat");
      }

      // Refresh the timeline data to show the new message
      await this.dataManager.fetchData();
    } catch (error) {
      console.error("Error sending chat message:", error);
      const statusText = document.getElementById("statusText");
      if (statusText) {
        statusText.textContent = "Error sending message";
      }
    }
  }

  /**
   * Handle data changed event from the data manager
   */
  private handleDataChanged(eventData: {
    state: any;
    newMessages: TimelineMessage[];
    isFirstFetch?: boolean;
  }): void {
    const { state, newMessages, isFirstFetch } = eventData;

    // Check if we should scroll to bottom BEFORE handling new data
    this.shouldScrollToBottom = this.checkShouldScroll();

    // Update state info in the UI
    this.updateUIWithState(state);

    // Update the timeline if there are new messages
    if (newMessages.length > 0) {
      // Initialize the message renderer with current state
      this.messageRenderer.initialize(
        this.dataManager.getIsFirstLoad(),
        this.dataManager.getCurrentFetchStartIndex()
      );

      this.messageRenderer.renderTimeline(newMessages, isFirstFetch || false);

      // Update chart data using our full messages array
      this.chartManager.setChartData(
        this.chartManager.calculateCumulativeCostData(
          this.dataManager.getMessages()
        )
      );

      // If in charts view, update the charts
      if (this.viewMode === "charts") {
        this.chartManager.renderCharts();
      }

      const statusTextEl = document.getElementById("statusText");
      if (statusTextEl) {
        statusTextEl.textContent = "Updated just now";
      }
    } else {
      const statusTextEl = document.getElementById("statusText");
      if (statusTextEl) {
        statusTextEl.textContent = "No new messages";
      }
    }
  }

  /**
   * Handle connection status changed event from the data manager
   */
  private handleConnectionStatusChanged(
    status: ConnectionStatus,
    errorMessage?: string
  ): void {
    const pollingIndicator = document.getElementById("pollingIndicator");
    if (!pollingIndicator) return;

    // Remove all status classes
    pollingIndicator.classList.remove("active", "error");

    // Add appropriate class based on status
    if (status === "connected") {
      pollingIndicator.classList.add("active");
    } else if (status === "disconnected") {
      pollingIndicator.classList.add("error");
    }

    // Update status text if error message is provided
    if (errorMessage) {
      const statusTextEl = document.getElementById("statusText");
      if (statusTextEl) {
        statusTextEl.textContent = errorMessage;
      }
    }
  }

  /**
   * Update UI elements with state data
   */
  private updateUIWithState(state: any): void {
    // Update state info in the UI with safe getters
    const hostnameEl = document.getElementById("hostname");
    if (hostnameEl) {
      hostnameEl.textContent = state?.hostname ?? "Unknown";
    }

    const workingDirEl = document.getElementById("workingDir");
    if (workingDirEl) {
      workingDirEl.textContent = state?.working_dir ?? "Unknown";
    }

    const initialCommitEl = document.getElementById("initialCommit");
    if (initialCommitEl) {
      initialCommitEl.textContent = state?.initial_commit
        ? state.initial_commit.substring(0, 8)
        : "Unknown";
    }

    const messageCountEl = document.getElementById("messageCount");
    if (messageCountEl) {
      messageCountEl.textContent = state?.message_count ?? "0";
    }

    const chatTitleEl = document.getElementById("chatTitle");
    const bannerTitleEl = document.querySelector(".banner-title");

    if (chatTitleEl && bannerTitleEl) {
      if (state?.title) {
        chatTitleEl.textContent = state.title;
        chatTitleEl.style.display = "block";
        bannerTitleEl.textContent = "sketch"; // Shorten title when chat title exists
      } else {
        chatTitleEl.style.display = "none";
        bannerTitleEl.textContent = "sketch coding assistant"; // Full title when no chat title
      }
    }

    // Get token and cost info safely
    const inputTokens = state?.total_usage?.input_tokens ?? 0;
    const outputTokens = state?.total_usage?.output_tokens ?? 0;
    const cacheReadInputTokens =
      state?.total_usage?.cache_read_input_tokens ?? 0;
    const cacheCreationInputTokens =
      state?.total_usage?.cache_creation_input_tokens ?? 0;
    const totalCost = state?.total_usage?.total_cost_usd ?? 0;

    const inputTokensEl = document.getElementById("inputTokens");
    if (inputTokensEl) {
      inputTokensEl.textContent = formatNumber(inputTokens, "0");
    }

    const outputTokensEl = document.getElementById("outputTokens");
    if (outputTokensEl) {
      outputTokensEl.textContent = formatNumber(outputTokens, "0");
    }

    const cacheReadInputTokensEl = document.getElementById(
      "cacheReadInputTokens"
    );
    if (cacheReadInputTokensEl) {
      cacheReadInputTokensEl.textContent = formatNumber(
        cacheReadInputTokens,
        "0"
      );
    }

    const cacheCreationInputTokensEl = document.getElementById(
      "cacheCreationInputTokens"
    );
    if (cacheCreationInputTokensEl) {
      cacheCreationInputTokensEl.textContent = formatNumber(
        cacheCreationInputTokens,
        "0"
      );
    }

    const totalCostEl = document.getElementById("totalCost");
    if (totalCostEl) {
      totalCostEl.textContent = `$${totalCost.toFixed(2)}`;
    }
  }

  /**
   * Check if we should scroll to the bottom
   */
  private checkShouldScroll(): boolean {
    return checkShouldScroll(this.dataManager.getIsFirstLoad());
  }

  /**
   * Dynamically adjust body padding based on the chat container height and top banner
   */
  private adjustChatSpacing(): void {
    const chatContainer = document.querySelector(".chat-container");
    const topBanner = document.querySelector(".top-banner");

    if (chatContainer) {
      const chatHeight = (chatContainer as HTMLElement).offsetHeight;
      document.body.style.paddingBottom = `${chatHeight + 20}px`; // 20px extra for spacing
    }

    if (topBanner) {
      const topHeight = (topBanner as HTMLElement).offsetHeight;
      document.body.style.paddingTop = `${topHeight + 20}px`; // 20px extra for spacing
    }
  }

  /**
   * Set up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    // Add keyboard shortcut to automatically copy selected text with Ctrl+C (or Command+C on Mac)
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      // We only want to handle Ctrl+C or Command+C
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        // If text is already selected, we don't need to do anything special
        // as the browser's default behavior will handle copying
        // But we could add additional behavior here if needed
      }
    });
  }

  /**
   * Toggle between different view modes: chat, diff2, charts
   */
  public async toggleViewMode(
    mode: "chat" | "diff2" | "charts" | "terminal"
  ): Promise<void> {
    // Set the new view mode
    this.viewMode = mode;

    // Update URL with the current view mode
    this.updateUrlForViewMode(mode);

    // Get DOM elements
    const timeline = document.getElementById("timeline");
    const diff2View = document.getElementById("diff2View");
    const chartView = document.getElementById("chartView");
    const container = document.querySelector(".timeline-container");
    const terminalView = document.getElementById("terminalView");
    const conversationButton = document.getElementById(
      "showConversationButton"
    );
    const diff2Button = document.getElementById("showDiff2Button");
    const chartsButton = document.getElementById("showChartsButton");
    const terminalButton = document.getElementById("showTerminalButton");

    if (
      !timeline ||
      !diff2View ||
      !chartView ||
      !container ||
      !conversationButton ||
      !diff2Button ||
      !chartsButton ||
      !terminalView ||
      !terminalButton
    ) {
      console.error("Required DOM elements not found");
      return;
    }

    // Hide all views first
    timeline.style.display = "none";
    diff2View.style.display = "none";
    chartView.style.display = "none";
    terminalView.style.display = "none";

    // Reset all button states
    conversationButton.classList.remove("active");
    diff2Button.classList.remove("active");
    chartsButton.classList.remove("active");
    terminalButton.classList.remove("active");

    // Remove diff2-active and diff-active classes from container
    container.classList.remove("diff2-active");
    container.classList.remove("diff-active");

    // If switching to chat view, clear the current commit hash
    if (mode === "chat") {
      this.diffViewer.clearCurrentCommitHash();
    }

    // Add class to indicate views are initialized (prevents flash of content)
    container.classList.add("view-initialized");

    // Show the selected view based on mode
    switch (mode) {
      case "chat":
        timeline.style.display = "block";
        conversationButton.classList.add("active");
        break;
      case "diff2":
        diff2View.style.display = "block";
        diff2Button.classList.add("active");
        this.diffViewer.setViewMode(mode); // Update view mode in diff viewer
        await this.diffViewer.loadDiff2HtmlContent();
        break;
      case "charts":
        chartView.style.display = "block";
        chartsButton.classList.add("active");
        await this.chartManager.renderCharts();
        break;
      case "terminal":
        terminalView.style.display = "block";
        terminalButton.classList.add("active");
        this.terminalHandler.setViewMode(mode); // Update view mode in terminal handler
        this.diffViewer.setViewMode(mode); // Update view mode in diff viewer
        await this.initializeTerminal();
        break;
    }
  }

  /**
   * Initialize the terminal view
   */
  private async initializeTerminal(): Promise<void> {
    // Use the TerminalHandler to initialize the terminal
    await this.terminalHandler.initializeTerminal();
  }

  /**
   * Initialize the view based on URL parameters
   * This allows bookmarking and sharing of specific views
   */
  private async initializeViewFromUrl(): Promise<void> {
    // Parse the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get("view");
    const commitParam = urlParams.get("commit");

    // Default to chat view if no valid view parameter is provided
    if (!viewParam) {
      // Explicitly set chat view to ensure button state is correct
      await this.toggleViewMode("chat");
      return;
    }

    // Check if the view parameter is valid
    if (
      viewParam === "chat" ||
      viewParam === "diff2" ||
      viewParam === "charts" ||
      viewParam === "terminal"
    ) {
      // If it's a diff view with a commit hash, set the commit hash
      if (viewParam === "diff2" && commitParam) {
        this.diffViewer.setCurrentCommitHash(commitParam);
      }

      // Set the view mode
      await this.toggleViewMode(
        viewParam as "chat" | "diff2" | "charts" | "terminal"
      );
    }
  }

  /**
   * Update URL to reflect current view mode for bookmarking and sharing
   * @param mode The current view mode
   */
  private updateUrlForViewMode(
    mode: "chat" | "diff2" | "charts" | "terminal"
  ): void {
    // Get the current URL without search parameters
    const url = new URL(window.location.href);

    // Clear existing parameters
    url.search = "";

    // Only add view parameter if not in default chat view
    if (mode !== "chat") {
      url.searchParams.set("view", mode);

      // If in diff view and there's a commit hash, include that too
      if (mode === "diff2" && this.diffViewer.getCurrentCommitHash()) {
        url.searchParams.set("commit", this.diffViewer.getCurrentCommitHash());
      }
    }

    // Update the browser history without reloading the page
    window.history.pushState({ mode }, "", url.toString());
  }

  /**
   * Stop the inner loop by calling the /cancel endpoint
   */
  private async stopInnerLoop(): Promise<void> {
    if (!confirm("Are you sure you want to stop the current operation?")) {
      return;
    }

    try {
      const statusText = document.getElementById("statusText");
      if (statusText) {
        statusText.textContent = "Cancelling...";
      }

      const response = await fetch("cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "User requested cancellation via UI" }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }

      // Parse the response
      const _result = await response.json();
      if (statusText) {
        statusText.textContent = "Operation cancelled";
      }
    } catch (error) {
      console.error("Error cancelling operation:", error);
      const statusText = document.getElementById("statusText");
      if (statusText) {
        statusText.textContent = "Error cancelling operation";
      }
    }
  }
}

// Create and initialize the timeline manager when the page loads
const _timelineManager = new TimelineManager();
