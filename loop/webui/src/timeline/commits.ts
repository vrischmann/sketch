/**
 * Utility functions for rendering commit messages in the timeline
 */

import { escapeHTML } from "./utils";

interface Commit {
  hash: string;
  subject: string;
  body: string;
  pushed_branch?: string;
}

/**
 * Create HTML elements to display commits in the timeline
 * @param commits List of commit information to display
 * @param diffViewerCallback Callback function to show commit diff when requested
 * @returns The created HTML container element with commit information
 */
export function createCommitsContainer(
  commits: Commit[],
  diffViewerCallback: (commitHash: string) => void
): HTMLElement {
  const commitsContainer = document.createElement("div");
  commitsContainer.className = "commits-container";

  // Create a header for commits
  const commitsHeaderRow = document.createElement("div");
  commitsHeaderRow.className = "commits-header";
  commitsHeaderRow.textContent = `${commits.length} new commit${commits.length > 1 ? "s" : ""} detected`;
  commitsContainer.appendChild(commitsHeaderRow);

  // Create a row for commit boxes
  const commitBoxesRow = document.createElement("div");
  commitBoxesRow.className = "commit-boxes-row";

  // Add each commit as a box
  commits.forEach((commit) => {
    // Create the commit box
    const commitBox = document.createElement("div");
    commitBox.className = "commit-box";

    // Show commit hash and subject line as the preview
    const commitPreview = document.createElement("div");
    commitPreview.className = "commit-preview";

    // Include pushed branch information if available
    let previewHTML = `<span class="commit-hash">${commit.hash.substring(0, 8)}</span> ${escapeHTML(commit.subject)}`;
    if (commit.pushed_branch) {
      previewHTML += ` <span class="pushed-branch">→ pushed to ${escapeHTML(commit.pushed_branch)}</span>`;
    }

    commitPreview.innerHTML = previewHTML;
    commitBox.appendChild(commitPreview);

    // Create expandable view for commit details
    const expandedView = document.createElement("div");
    expandedView.className = "commit-details is-hidden";
    expandedView.innerHTML = `<pre>${escapeHTML(commit.body)}</pre>`;
    commitBox.appendChild(expandedView);

    // Toggle visibility of expanded view when clicking the preview
    commitPreview.addEventListener("click", (event) => {
      // If holding Ctrl/Cmd key, show diff for this commit
      if (event.ctrlKey || event.metaKey) {
        // Call the diff viewer callback with the commit hash
        diffViewerCallback(commit.hash);
      } else {
        // Normal behavior - toggle expanded view
        expandedView.classList.toggle("is-hidden");
      }
    });
    
    // Add a diff button to view commit changes
    const diffButton = document.createElement("button");
    diffButton.className = "commit-diff-button";
    diffButton.textContent = "View Changes";
    diffButton.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent triggering the parent click event
      diffViewerCallback(commit.hash);
    });
    // Add the button directly to the commit box
    commitBox.appendChild(diffButton);

    commitBoxesRow.appendChild(commitBox);
  });

  commitsContainer.appendChild(commitBoxesRow);
  return commitsContainer;
}
