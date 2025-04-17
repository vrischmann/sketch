import * as Diff2Html from "diff2html";

/**
 * Class to handle diff and commit viewing functionality in the timeline UI.
 */
export class DiffViewer {
  // Current commit hash being viewed
  private currentCommitHash: string = "";
  // Selected line in the diff for commenting
  private selectedDiffLine: string | null = null;
  // Current view mode (needed for integration with TimelineManager)
  private viewMode: string = "chat";

  /**
   * Constructor for DiffViewer
   */
  constructor() {}

  /**
   * Sets the current view mode
   * @param mode The current view mode
   */
  public setViewMode(mode: string): void {
    this.viewMode = mode;
  }

  /**
   * Gets the current commit hash
   * @returns The current commit hash
   */
  public getCurrentCommitHash(): string {
    return this.currentCommitHash;
  }

  /**
   * Sets the current commit hash
   * @param hash The commit hash to set
   */
  public setCurrentCommitHash(hash: string): void {
    this.currentCommitHash = hash;
  }

  /**
   * Clears the current commit hash
   */
  public clearCurrentCommitHash(): void {
    this.currentCommitHash = "";
  }

  /**
   * Loads diff content and renders it using diff2html
   * @param commitHash Optional commit hash to load diff for
   */
  public async loadDiff2HtmlContent(commitHash?: string): Promise<void> {
    const diff2htmlContent = document.getElementById("diff2htmlContent");
    const container = document.querySelector(".timeline-container");
    if (!diff2htmlContent || !container) return;

    try {
      // Show loading state
      diff2htmlContent.innerHTML = "Loading enhanced diff...";

      // Add classes to container to allow full-width rendering
      container.classList.add("diff2-active");
      container.classList.add("diff-active");
      
      // Use currentCommitHash if provided or passed from parameter
      const hash = commitHash || this.currentCommitHash;
      
      // Build the diff URL - include commit hash if specified
      const diffUrl = hash ? `diff?commit=${hash}` : "diff";
      
      // Fetch the diff from the server
      const response = await fetch(diffUrl);

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`,
        );
      }

      const diffText = await response.text();

      if (!diffText || diffText.trim() === "") {
        diff2htmlContent.innerHTML =
          "<span style='color: #666; font-style: italic;'>No changes detected since conversation started.</span>";
        return;
      }

      // Get the selected view format
      const formatRadios = document.getElementsByName("diffViewFormat") as NodeListOf<HTMLInputElement>;
      let outputFormat = "side-by-side"; // default
      
      // Convert NodeListOf to Array to ensure [Symbol.iterator]() is available
      Array.from(formatRadios).forEach(radio => {
        if (radio.checked) {
          outputFormat = radio.value as "side-by-side" | "line-by-line";
        }
      })
      
      // Render the diff using diff2html
      const diffHtml = Diff2Html.html(diffText, {
        outputFormat: outputFormat as "side-by-side" | "line-by-line",
        drawFileList: true,
        matching: "lines",
        // Make sure no unnecessary scrollbars in the nested containers
        renderNothingWhenEmpty: false,
        colorScheme: "light" as any, // Force light mode to match the rest of the UI
      });

      // Insert the generated HTML
      diff2htmlContent.innerHTML = diffHtml;

      // Add CSS styles to ensure we don't have double scrollbars
      const d2hFiles = diff2htmlContent.querySelectorAll(".d2h-file-wrapper");
      d2hFiles.forEach((file) => {
        const contentElem = file.querySelector(".d2h-files-diff");
        if (contentElem) {
          // Remove internal scrollbar - the outer container will handle scrolling
          (contentElem as HTMLElement).style.overflow = "visible";
          (contentElem as HTMLElement).style.maxHeight = "none";
        }
      });

      // Add click event handlers to each code line for commenting
      this.setupDiff2LineComments();
      
      // Setup event listeners for diff view format radio buttons
      this.setupDiffViewFormatListeners();
    } catch (error) {
      console.error("Error loading diff2html content:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      diff2htmlContent.innerHTML = `<span style='color: #dc3545;'>Error loading enhanced diff: ${errorMessage}</span>`;
    }
  }

  /**
   * Setup event listeners for diff view format radio buttons
   */
  private setupDiffViewFormatListeners(): void {
    const formatRadios = document.getElementsByName("diffViewFormat") as NodeListOf<HTMLInputElement>;
    
    // Convert NodeListOf to Array to ensure [Symbol.iterator]() is available
    Array.from(formatRadios).forEach(radio => {
      radio.addEventListener("change", () => {
        // Reload the diff with the new format when radio selection changes
        this.loadDiff2HtmlContent(this.currentCommitHash);
      });
    })
  }
  
  /**
   * Setup handlers for diff2 code lines to enable commenting
   */
  private setupDiff2LineComments(): void {
    const diff2htmlContent = document.getElementById("diff2htmlContent");
    if (!diff2htmlContent) return;

    console.log("Setting up diff2 line comments");

    // Add plus buttons to each code line
    this.addCommentButtonsToCodeLines();

    // Use event delegation for handling clicks on plus buttons
    diff2htmlContent.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      
      // Only respond to clicks on the plus button
      if (target.classList.contains("d2h-gutter-comment-button")) {
        // Find the parent row first
        const row = target.closest("tr");
        if (!row) return;
        
        // Then find the code line in that row
        const codeLine = row.querySelector(".d2h-code-side-line") || row.querySelector(".d2h-code-line");
        if (!codeLine) return;

        // Get the line text content
        const lineContent = codeLine.querySelector(".d2h-code-line-ctn");
        if (!lineContent) return;

        const lineText = lineContent.textContent?.trim() || "";

        // Get file name to add context
        const fileHeader = codeLine
          .closest(".d2h-file-wrapper")
          ?.querySelector(".d2h-file-name");
        const fileName = fileHeader
          ? fileHeader.textContent?.trim()
          : "Unknown file";

        // Get line number if available
        const lineNumElem = codeLine
          .closest("tr")
          ?.querySelector(".d2h-code-side-linenumber");
        const lineNum = lineNumElem ? lineNumElem.textContent?.trim() : "";
        const lineInfo = lineNum ? `Line ${lineNum}: ` : "";

        // Format the line for the comment box with file context and line number
        const formattedLine = `${fileName} ${lineInfo}${lineText}`;

        console.log("Comment button clicked for line: ", formattedLine);

        // Open the comment box with this line
        this.openDiffCommentBox(formattedLine, 0);

        // Prevent event from bubbling up
        event.stopPropagation();
      }
    });

    // Handle text selection
    let isSelecting = false;
    
    diff2htmlContent.addEventListener("mousedown", () => {
      isSelecting = false;
    });
    
    diff2htmlContent.addEventListener("mousemove", (event) => {
      // If mouse is moving with button pressed, user is selecting text
      if (event.buttons === 1) { // Primary button (usually left) is pressed
        isSelecting = true;
      }
    });
  }

  /**
   * Add plus buttons to each table row in the diff for commenting
   */
  private addCommentButtonsToCodeLines(): void {
    const diff2htmlContent = document.getElementById("diff2htmlContent");
    if (!diff2htmlContent) return;
    
    // Target code lines first, then find their parent rows
    const codeLines = diff2htmlContent.querySelectorAll(
      ".d2h-code-side-line, .d2h-code-line"
    );
    
    // Create a Set to store unique rows to avoid duplicates
    const rowsSet = new Set<HTMLElement>();
    
    // Get all rows that contain code lines
    codeLines.forEach(line => {
      const row = line.closest('tr');
      if (row) rowsSet.add(row as HTMLElement);
    });
    
    // Convert Set back to array for processing
    const codeRows = Array.from(rowsSet);
    
    codeRows.forEach((row) => {
      const rowElem = row as HTMLElement;
      
      // Skip info lines without actual code (e.g., "file added")
      if (rowElem.querySelector(".d2h-info")) {
        return;
      }
      
      // Find the code line number element (first TD in the row)
      const lineNumberCell = rowElem.querySelector(
        ".d2h-code-side-linenumber, .d2h-code-linenumber"
      );
      
      if (!lineNumberCell) return;
      
      // Create the plus button
      const plusButton = document.createElement("span");
      plusButton.className = "d2h-gutter-comment-button";
      plusButton.innerHTML = "+";
      plusButton.title = "Add a comment on this line";
      
      // Add button to the line number cell for proper positioning
      (lineNumberCell as HTMLElement).style.position = "relative"; // Ensure positioning context
      lineNumberCell.appendChild(plusButton);
    });
  }

  /**
   * Open the comment box for a selected diff line
   */
  private openDiffCommentBox(lineText: string, _lineNumber: number): void {
    const commentBox = document.getElementById("diffCommentBox");
    const selectedLine = document.getElementById("selectedLine");
    const commentInput = document.getElementById(
      "diffCommentInput",
    ) as HTMLTextAreaElement;

    if (!commentBox || !selectedLine || !commentInput) return;

    // Store the selected line
    this.selectedDiffLine = lineText;

    // Display the line in the comment box
    selectedLine.textContent = lineText;

    // Reset the comment input
    commentInput.value = "";

    // Show the comment box
    commentBox.style.display = "block";

    // Focus on the comment input
    commentInput.focus();

    // Add event listeners for submit and cancel buttons
    const submitButton = document.getElementById("submitDiffComment");
    if (submitButton) {
      submitButton.onclick = () => this.submitDiffComment();
    }

    const cancelButton = document.getElementById("cancelDiffComment");
    if (cancelButton) {
      cancelButton.onclick = () => this.closeDiffCommentBox();
    }
  }

  /**
   * Close the diff comment box without submitting
   */
  private closeDiffCommentBox(): void {
    const commentBox = document.getElementById("diffCommentBox");
    if (commentBox) {
      commentBox.style.display = "none";
    }
    this.selectedDiffLine = null;
  }

  /**
   * Submit a comment on a diff line
   */
  private submitDiffComment(): void {
    const commentInput = document.getElementById(
      "diffCommentInput",
    ) as HTMLTextAreaElement;
    const chatInput = document.getElementById(
      "chatInput",
    ) as HTMLTextAreaElement;

    if (!commentInput || !chatInput) return;

    const comment = commentInput.value.trim();

    // Validate inputs
    if (!this.selectedDiffLine || !comment) {
      alert("Please select a line and enter a comment.");
      return;
    }

    // Format the comment in a readable way
    const formattedComment = `\`\`\`\n${this.selectedDiffLine}\n\`\`\`\n\n${comment}`;

    // Append the formatted comment to the chat textarea
    if (chatInput.value.trim() !== "") {
      chatInput.value += "\n\n"; // Add two line breaks before the new comment
    }
    chatInput.value += formattedComment;
    chatInput.focus();

    // Close only the comment box but keep the diff view open
    this.closeDiffCommentBox();
  }

  /**
   * Show diff for a specific commit
   * @param commitHash The commit hash to show diff for
   * @param toggleViewModeCallback Callback to toggle view mode to diff
   */
  public showCommitDiff(commitHash: string, toggleViewModeCallback: (mode: string) => void): void {
    // Store the commit hash
    this.currentCommitHash = commitHash;
    
    // Switch to diff2 view (side-by-side)
    toggleViewModeCallback("diff2");
  }

  /**
   * Clean up resources when component is destroyed
   */
  public dispose(): void {
    // Clean up any resources or event listeners here
    // Currently there are no specific resources to clean up
  }
}
