/**
 * Check if the page should scroll to the bottom based on current view position
 * @param isFirstLoad If this is the first load of the timeline
 * @returns Boolean indicating if we should scroll to the bottom
 */
export function checkShouldScroll(isFirstLoad: boolean): boolean {
  // Always scroll on first load
  if (isFirstLoad) {
    return true;
  }

  // Check if user is already near the bottom of the page
  // Account for the fixed top bar and chat bar
  return (
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 200
  );
}

/**
 * Scroll to the bottom of the timeline if shouldScrollToBottom is true
 * @param shouldScrollToBottom Flag indicating if we should scroll
 */
export function scrollToBottom(shouldScrollToBottom: boolean): void {
  // Find the timeline container
  const timeline = document.getElementById("timeline");

  // Scroll the window to the bottom based on our pre-determined value
  if (timeline && shouldScrollToBottom) {
    // Get the last message or element in the timeline
    const lastElement = timeline.lastElementChild;

    if (lastElement) {
      // Scroll to the bottom of the page
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }
  }
}
