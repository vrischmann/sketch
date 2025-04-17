/**
 * Get the icon text to display for a message type
 * @param type - The message type
 * @returns The single character to represent this message type
 */
export function getIconText(type: string | null | undefined): string {
  switch (type) {
    case "user":
      return "U";
    case "agent":
      return "A";
    case "tool":
      return "T";
    case "error":
      return "E";
    default:
      return "?";
  }
}
