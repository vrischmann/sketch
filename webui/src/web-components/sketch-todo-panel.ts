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
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
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
    const statusIcon = {
      queued: '⚪',
      'in-progress': '🦉',
      completed: '✅'
    }[item.status] || '?';

    return html`
      <div class="todo-item ${item.status}">
        <div class="todo-status-icon">${statusIcon}</div>
        <div class="todo-main">
          <div class="todo-content-text">${item.task}</div>

        </div>
      </div>
    `;
  }

  render() {
    if (!this.visible) {
      return html``;
    }

    const todoIcon = html`
      <svg class="todo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <div class="todo-content error">
          Error: ${this.error}
        </div>
      `;
    } else if (!this.todoList || !this.todoList.items || this.todoList.items.length === 0) {
      contentElement = html`
        <div class="todo-content empty">
          No todos available
        </div>
      `;
    } else {
      const totalCount = this.todoList.items.length;
      const completedCount = this.todoList.items.filter(item => item.status === 'completed').length;
      const inProgressCount = this.todoList.items.filter(item => item.status === 'in-progress').length;
      
      contentElement = html`
        <div class="todo-header">
          <div class="todo-header-text">
            ${todoIcon}
            <span>Sketching...</span>
            <span class="todo-count">${completedCount}/${totalCount}</span>
          </div>
        </div>
        <div class="todo-content">
          ${this.todoList.items.map(item => this.renderTodoItem(item))}
        </div>
      `;
    }

    return html`
      ${contentElement}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-todo-panel": SketchTodoPanel;
  }
}