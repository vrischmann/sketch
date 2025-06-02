import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { TodoList, TodoItem } from "../types.js";

@customElement("sketch-todo-panel")
export class SketchTodoPanel extends LitElement {
  @property()
  visible: boolean = false;

  @state()
  private todoList: TodoList | null = null;

  @state()
  private loading: boolean = false;

  @state()
  private error: string = "";

  @state()
  private showCommentBox: boolean = false;

  @state()
  private commentingItem: TodoItem | null = null;

  @state()
  private commentText: string = "";

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: transparent; /* Let parent handle background */
      overflow: hidden; /* Ensure proper clipping */
    }

    .todo-header {
      padding: 8px 12px;
      border-bottom: 1px solid #e0e0e0;
      background-color: #f5f5f5;
      font-weight: 600;
      font-size: 13px;
      color: #333;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .todo-icon {
      width: 14px;
      height: 14px;
      color: #666;
    }

    .todo-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      padding-bottom: 20px; /* Extra bottom padding for better scrolling */
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      font-size: 12px;
      line-height: 1.4;
      /* Ensure scrollbar is always accessible */
      min-height: 0;
    }

    .todo-content.loading {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
    }

    .todo-content.error {
      color: #d32f2f;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .todo-content.empty {
      color: #999;
      font-style: italic;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Todo item styling */
    .todo-item {
      display: flex;
      align-items: flex-start;
      padding: 8px;
      margin-bottom: 6px;
      border-radius: 4px;
      background-color: #fff;
      border: 1px solid #e0e0e0;
      gap: 8px;
      min-height: 24px; /* Ensure consistent height */
    }

    .todo-item.queued {
      border-left: 3px solid #e0e0e0;
    }

    .todo-item.in-progress {
      border-left: 3px solid #e0e0e0;
    }

    .todo-item.completed {
      border-left: 3px solid #e0e0e0;
    }

    .todo-status-icon {
      font-size: 14px;
      margin-top: 1px;
      flex-shrink: 0;
    }

    .todo-main {
      flex: 1;
      min-width: 0;
    }

    .todo-content-text {
      font-size: 12px;
      line-height: 1.3;
      color: #333;
      word-wrap: break-word;
    }

    .todo-item-content {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      width: 100%;
      min-height: 20px; /* Ensure consistent height */
    }

    .todo-text-section {
      flex: 1;
      min-width: 0;
      padding-right: 8px; /* Space between text and button column */
    }

    .todo-actions-column {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      width: 24px; /* Fixed width for button column */
      justify-content: center;
    }

    .comment-button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      color: #666;
      opacity: 0.7;
      transition: opacity 0.2s ease;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .comment-button:hover {
      opacity: 1;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
    }

    /* Comment box overlay */
    .comment-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-in-out;
    }

    .comment-box {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      padding: 16px;
      width: 400px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
    }

    .comment-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .comment-box-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
    }

    .close-button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #666;
      padding: 2px 6px;
    }

    .close-button:hover {
      color: #333;
    }

    .todo-context {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }

    .todo-context-status {
      font-weight: 500;
      color: #666;
      margin-bottom: 4px;
    }

    .todo-context-task {
      color: #333;
    }

    .comment-textarea {
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      font-family: inherit;
      font-size: 12px;
      margin-bottom: 12px;
      box-sizing: border-box;
    }

    .comment-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .comment-actions button {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .cancel-button {
      background-color: transparent;
      border: 1px solid #ddd;
      color: #666;
    }

    .cancel-button:hover {
      background-color: #f5f5f5;
    }

    .submit-button {
      background-color: #4285f4;
      color: white;
      border: none;
    }

    .submit-button:hover {
      background-color: #3367d6;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .todo-header-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .todo-count {
      background-color: #e0e0e0;
      color: #666;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: normal;
    }

    /* Loading spinner */
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  `;

  updateTodoContent(content: string) {
    try {
      if (!content.trim()) {
        this.todoList = null;
      } else {
        this.todoList = JSON.parse(content) as TodoList;
      }
      this.loading = false;
      this.error = "";
    } catch (error) {
      console.error("Failed to parse todo content:", error);
      this.error = "Failed to parse todo data";
      this.todoList = null;
      this.loading = false;
    }
  }

  private renderTodoItem(item: TodoItem) {
    const statusIcon =
      {
        queued: "⚪",
        "in-progress": "🦉",
        completed: "✅",
      }[item.status] || "?";

    // Only show comment button for non-completed items
    const showCommentButton = item.status !== "completed";

    return html`
      <div class="todo-item ${item.status}">
        <div class="todo-status-icon">${statusIcon}</div>
        <div class="todo-item-content">
          <div class="todo-text-section">
            <div class="todo-content-text">${item.task}</div>
          </div>
          <div class="todo-actions-column">
            ${showCommentButton ? html`
              <button 
                class="comment-button" 
                @click="${() => this.openCommentBox(item)}"
                title="Add comment about this TODO item"
              >
                💬
              </button>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.visible) {
      return html``;
    }

    const todoIcon = html`
      <svg
        class="todo-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
      </svg>
    `;

    let contentElement;
    if (this.loading) {
      contentElement = html`
        <div class="todo-content loading">
          <div class="spinner"></div>
          Loading todos...
        </div>
      `;
    } else if (this.error) {
      contentElement = html`
        <div class="todo-content error">Error: ${this.error}</div>
      `;
    } else if (
      !this.todoList ||
      !this.todoList.items ||
      this.todoList.items.length === 0
    ) {
      contentElement = html`
        <div class="todo-content empty">No todos available</div>
      `;
    } else {
      const totalCount = this.todoList.items.length;
      const completedCount = this.todoList.items.filter(
        (item) => item.status === "completed",
      ).length;
      const inProgressCount = this.todoList.items.filter(
        (item) => item.status === "in-progress",
      ).length;

      contentElement = html`
        <div class="todo-header">
          <div class="todo-header-text">
            ${todoIcon}
            <span>Sketching...</span>
            <span class="todo-count">${completedCount}/${totalCount}</span>
          </div>
        </div>
        <div class="todo-content">
          ${this.todoList.items.map((item) => this.renderTodoItem(item))}
        </div>
      `;
    }

    return html`
      ${contentElement}
      
      ${this.showCommentBox ? this.renderCommentBox() : ""}
    `;
  }

  private renderCommentBox() {
    if (!this.commentingItem) return "";

    const statusText = {
      queued: "Queued",
      "in-progress": "In Progress", 
      completed: "Completed"
    }[this.commentingItem.status] || this.commentingItem.status;

    return html`
      <div class="comment-overlay" @click="${this.handleOverlayClick}">
        <div class="comment-box" @click="${this.stopPropagation}">
          <div class="comment-box-header">
            <h3>Comment on TODO Item</h3>
            <button class="close-button" @click="${this.closeCommentBox}">
              ×
            </button>
          </div>
          
          <div class="todo-context">
            <div class="todo-context-status">Status: ${statusText}</div>
            <div class="todo-context-task">${this.commentingItem.task}</div>
          </div>
          
          <textarea
            class="comment-textarea"
            placeholder="Type your comment about this TODO item..."
            .value="${this.commentText}"
            @input="${this.handleCommentInput}"
          ></textarea>
          
          <div class="comment-actions">
            <button class="cancel-button" @click="${this.closeCommentBox}">
              Cancel
            </button>
            <button class="submit-button" @click="${this.submitComment}">
              Add Comment
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private openCommentBox(item: TodoItem) {
    this.commentingItem = item;
    this.commentText = "";
    this.showCommentBox = true;
  }

  private closeCommentBox() {
    this.showCommentBox = false;
    this.commentingItem = null;
    this.commentText = "";
  }

  private handleOverlayClick(e: Event) {
    // Close when clicking outside the comment box
    this.closeCommentBox();
  }

  private stopPropagation(e: Event) {
    // Prevent clicks inside the comment box from closing it
    e.stopPropagation();
  }

  private handleCommentInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.commentText = target.value;
  }

  private submitComment() {
    if (!this.commentingItem || !this.commentText.trim()) {
      return;
    }

    // Format the comment similar to diff comments
    const statusText = {
      queued: "Queued",
      "in-progress": "In Progress", 
      completed: "Completed"
    }[this.commentingItem.status] || this.commentingItem.status;

    const formattedComment = `\`\`\`
TODO Item (${statusText}): ${this.commentingItem.task}
\`\`\`

${this.commentText}`;

    // Dispatch a custom event similar to diff comments
    const event = new CustomEvent("todo-comment", {
      detail: { comment: formattedComment },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
    
    // Close the comment box
    this.closeCommentBox();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-todo-panel": SketchTodoPanel;
  }
}
