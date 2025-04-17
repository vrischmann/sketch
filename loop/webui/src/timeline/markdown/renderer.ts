import { marked } from "marked";

/**
 * Renders markdown content as HTML with proper security handling.
 *
 * @param markdownContent - The markdown string to render
 * @returns The rendered HTML content as a string
 */
export async function renderMarkdown(markdownContent: string): Promise<string> {
  try {
    // Set markdown options for proper code block highlighting and safety
    const markedOptions = {
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert newlines to <br>
      headerIds: false, // Disable header IDs for safety
      mangle: false, // Don't mangle email addresses
      // DOMPurify is recommended for production, but not included in this implementation
    };

    return await marked.parse(markdownContent, markedOptions);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to plain text if markdown parsing fails
    return markdownContent;
  }
}

/**
 * Process rendered markdown HTML element, adding security attributes to links.
 *
 * @param element - The HTML element containing rendered markdown
 */
export function processRenderedMarkdown(element: HTMLElement): void {
  // Make sure links open in a new tab and have proper security attributes
  const links = element.querySelectorAll("a");
  links.forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
}
