/* eslint-disable @typescript-eslint/no-explicit-any */
import { DemoModule } from "./demo-framework/types";
import { demoUtils } from "./demo-fixtures/index";

const demo: DemoModule = {
  title: "Sketch Network Status Demo",
  description:
    "Status indicators showing different connection and activity states",
  imports: ["../sketch-network-status.ts", "../sketch-call-status.ts"],

  customStyles: `
    .status-container {
      margin: 20px 0;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .label {
      font-weight: bold;
      margin-bottom: 5px;
    }
  `,

  setup: async (container: HTMLElement) => {
    const section = demoUtils.createDemoSection(
      "Status Indicators",
      "Demonstrates different connection and activity states using sketch-call-status component",
    );

    // Connected State
    const connectedContainer = document.createElement("div");
    connectedContainer.className = "status-container";

    const connectedLabel = document.createElement("div");
    connectedLabel.className = "label";
    connectedLabel.textContent = "Connected State:";

    const connectedStatus = document.createElement("sketch-call-status") as any;
    connectedStatus.isDisconnected = false;
    connectedStatus.isIdle = true;
    connectedStatus.llmCalls = 0;
    connectedStatus.toolCalls = [];

    connectedContainer.appendChild(connectedLabel);
    connectedContainer.appendChild(connectedStatus);

    // Working State
    const workingContainer = document.createElement("div");
    workingContainer.className = "status-container";

    const workingLabel = document.createElement("div");
    workingLabel.className = "label";
    workingLabel.textContent = "Working State:";

    const workingStatus = document.createElement("sketch-call-status") as any;
    workingStatus.isDisconnected = false;
    workingStatus.isIdle = false;
    workingStatus.llmCalls = 1;
    workingStatus.toolCalls = ["bash"];

    workingContainer.appendChild(workingLabel);
    workingContainer.appendChild(workingStatus);

    // Disconnected State
    const disconnectedContainer = document.createElement("div");
    disconnectedContainer.className = "status-container";

    const disconnectedLabel = document.createElement("div");
    disconnectedLabel.className = "label";
    disconnectedLabel.textContent = "Disconnected State:";

    const disconnectedStatus = document.createElement(
      "sketch-call-status",
    ) as any;
    disconnectedStatus.isDisconnected = true;
    disconnectedStatus.isIdle = true;
    disconnectedStatus.llmCalls = 0;
    disconnectedStatus.toolCalls = [];

    disconnectedContainer.appendChild(disconnectedLabel);
    disconnectedContainer.appendChild(disconnectedStatus);

    // Add all containers to section
    section.appendChild(connectedContainer);
    section.appendChild(workingContainer);
    section.appendChild(disconnectedContainer);
    container.appendChild(section);
  },
};

export default demo;
