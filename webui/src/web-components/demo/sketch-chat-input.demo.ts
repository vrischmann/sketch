/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Demo module for sketch-chat-input component
 */

import { DemoModule } from "./demo-framework/types";
import { demoUtils } from "./demo-fixtures/index";

const demo: DemoModule = {
  title: "Chat Input Demo",
  description: "Interactive chat input component with send functionality",
  imports: ["../sketch-chat-input"],

  setup: async (container: HTMLElement) => {
    // Create demo sections
    const basicSection = demoUtils.createDemoSection(
      "Basic Chat Input",
      "Type a message and press Enter or click Send",
    );

    const messagesSection = demoUtils.createDemoSection(
      "Chat Messages",
      "Messages will appear here when sent",
    );

    // Create chat messages container
    const messagesDiv = document.createElement("div");
    messagesDiv.id = "chat-messages";
    messagesDiv.style.cssText = `
      min-height: 100px;
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #d1d9e0;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 10px;
      background: var(--demo-light-bg);
    `;

    // Create chat input
    const chatInput = document.createElement("sketch-chat-input") as any;
    chatInput.content = "Hello, how can I help you today?";

    // Add message to display
    const addMessage = (message: string, isUser: boolean = true) => {
      const messageDiv = document.createElement("div");
      messageDiv.style.cssText = `
        padding: 8px 12px;
        margin: 4px 0;
        border-radius: 6px;
        background: ${isUser ? "var(--demo-fixture-button-bg)" : "var(--demo-light-bg)"};
        color: ${isUser ? "white" : "#24292f"};
        max-width: 80%;
        margin-left: ${isUser ? "auto" : "0"};
        margin-right: ${isUser ? "0" : "auto"};
      `;
      messageDiv.textContent = message;
      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    // Handle send events
    chatInput.addEventListener("send-chat", (evt: any) => {
      const message = evt.detail.message;
      if (message.trim()) {
        addMessage(message, true);
        chatInput.content = "";

        // Simulate bot response after a delay
        setTimeout(() => {
          const responses = [
            "Thanks for your message!",
            "I understand your request.",
            "Let me help you with that.",
            "That's a great question!",
            "I'll look into that for you.",
          ];
          const randomResponse =
            responses[Math.floor(Math.random() * responses.length)];
          addMessage(randomResponse, false);
        }, 1000);
      }
    });

    // Add some sample messages
    addMessage("Welcome to the chat demo!", false);
    addMessage("This is a sample user message", true);

    // Control buttons
    const controlsDiv = document.createElement("div");
    controlsDiv.style.cssText = "margin-top: 15px;";

    const clearButton = demoUtils.createButton("Clear Messages", () => {
      messagesDiv.innerHTML = "";
      addMessage("Chat cleared!", false);
    });

    const presetButton = demoUtils.createButton("Add Preset Message", () => {
      chatInput.content = "Can you help me implement a file upload component?";
    });

    controlsDiv.appendChild(clearButton);
    controlsDiv.appendChild(presetButton);

    // Assemble the demo
    messagesSection.appendChild(messagesDiv);
    basicSection.appendChild(chatInput);
    basicSection.appendChild(controlsDiv);

    container.appendChild(messagesSection);
    container.appendChild(basicSection);
  },
};

export default demo;
