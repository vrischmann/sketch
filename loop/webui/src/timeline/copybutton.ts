/**
 * Creates a copy button container with a functioning copy button
 */
export function createCopyButton(textToCopy: string): {
  container: HTMLDivElement;
  button: HTMLButtonElement;
} {
  // Create container for the copy button
  const copyButtonContainer = document.createElement("div");
  copyButtonContainer.className = "message-actions";

  // Create the copy button itself
  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.textContent = "Copy";
  copyButton.title = "Copy text to clipboard";
  
  // Add click event listener to handle copying
  copyButton.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        copyButton.textContent = "Copied!";
        setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        copyButton.textContent = "Failed";
        setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 2000);
      });
  });

  copyButtonContainer.appendChild(copyButton);
  
  return {
    container: copyButtonContainer,
    button: copyButton
  };
}
