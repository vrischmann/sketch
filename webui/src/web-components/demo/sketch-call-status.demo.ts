/**
 * Demo module for sketch-call-status component
 */

import { DemoModule } from "./demo-framework/types";
import {
  demoUtils,
  idleCallStatus,
  workingCallStatus,
  heavyWorkingCallStatus,
  disconnectedCallStatus,
  workingDisconnectedCallStatus,
} from "./demo-fixtures/index";
import type { CallStatusState } from "./demo-fixtures/index";

const demo: DemoModule = {
  title: "Call Status Demo",
  description:
    "Display current LLM and tool call status with visual indicators",
  imports: ["../sketch-call-status"],
  styles: ["/dist/tailwind.css"],

  setup: async (container: HTMLElement) => {
    // Create demo sections
    const statusVariationsSection = demoUtils.createDemoSection(
      "Status Variations",
      "Different states of the call status component",
    );

    const interactiveSection = demoUtils.createDemoSection(
      "Interactive Demo",
      "Dynamically change call status to see real-time updates",
    );

    // Helper function to create status component with state
    const createStatusComponent = (
      id: string,
      state: CallStatusState,
      label: string,
    ) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "margin: 15px 0; padding: 10px; border: 1px solid #e1e5e9; border-radius: 6px; background: white;";

      const labelEl = document.createElement("h4");
      labelEl.textContent = label;
      labelEl.style.cssText =
        "margin: 0 0 10px 0; color: #24292f; font-size: 14px; font-weight: 600;";

      const statusComponent = document.createElement(
        "sketch-call-status",
      ) as any;
      statusComponent.id = id;
      statusComponent.llmCalls = state.llmCalls;
      statusComponent.toolCalls = state.toolCalls;
      statusComponent.agentState = state.agentState;
      statusComponent.isIdle = state.isIdle;
      statusComponent.isDisconnected = state.isDisconnected;

      wrapper.appendChild(labelEl);
      wrapper.appendChild(statusComponent);
      return wrapper;
    };

    // Create status variations
    const idleStatus = createStatusComponent(
      "idle-status",
      idleCallStatus,
      "Idle State - No active calls",
    );

    const workingStatus = createStatusComponent(
      "working-status",
      workingCallStatus,
      "Working State - LLM and tool calls active",
    );

    const heavyWorkingStatus = createStatusComponent(
      "heavy-working-status",
      heavyWorkingCallStatus,
      "Heavy Working State - Multiple calls active",
    );

    const disconnectedStatus = createStatusComponent(
      "disconnected-status",
      disconnectedCallStatus,
      "Disconnected State - No connection",
    );

    const workingDisconnectedStatus = createStatusComponent(
      "working-disconnected-status",
      workingDisconnectedCallStatus,
      "Working but Disconnected - Calls active but no connection",
    );

    // Interactive demo component
    const interactiveStatus = document.createElement(
      "sketch-call-status",
    ) as any;
    interactiveStatus.id = "interactive-status";
    interactiveStatus.llmCalls = 0;
    interactiveStatus.toolCalls = [];
    interactiveStatus.agentState = null;
    interactiveStatus.isIdle = true;
    interactiveStatus.isDisconnected = false;

    // Control buttons for interactive demo
    const controlsDiv = document.createElement("div");
    controlsDiv.style.cssText =
      "margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px;";

    const addLLMCallButton = demoUtils.createButton("Add LLM Call", () => {
      interactiveStatus.llmCalls = interactiveStatus.llmCalls + 1;
      interactiveStatus.isIdle = false;
    });

    const removeLLMCallButton = demoUtils.createButton(
      "Remove LLM Call",
      () => {
        interactiveStatus.llmCalls = Math.max(
          0,
          interactiveStatus.llmCalls - 1,
        );
        if (
          interactiveStatus.llmCalls === 0 &&
          interactiveStatus.toolCalls.length === 0
        ) {
          interactiveStatus.isIdle = true;
        }
      },
    );

    const addToolCallButton = demoUtils.createButton("Add Tool Call", () => {
      const toolNames = [
        "bash",
        "patch",
        "think",
        "keyword_search",
        "browser_navigate",
        "codereview",
      ];
      const randomTool =
        toolNames[Math.floor(Math.random() * toolNames.length)];
      const currentTools = Array.isArray(interactiveStatus.toolCalls)
        ? [...interactiveStatus.toolCalls]
        : [];
      if (!currentTools.includes(randomTool)) {
        currentTools.push(randomTool);
        interactiveStatus.toolCalls = currentTools;
        interactiveStatus.isIdle = false;
      }
    });

    const removeToolCallButton = demoUtils.createButton(
      "Remove Tool Call",
      () => {
        const currentTools = Array.isArray(interactiveStatus.toolCalls)
          ? [...interactiveStatus.toolCalls]
          : [];
        if (currentTools.length > 0) {
          currentTools.pop();
          interactiveStatus.toolCalls = currentTools;
          if (interactiveStatus.llmCalls === 0 && currentTools.length === 0) {
            interactiveStatus.isIdle = true;
          }
        }
      },
    );

    const toggleConnectionButton = demoUtils.createButton(
      "Toggle Connection",
      () => {
        interactiveStatus.isDisconnected = !interactiveStatus.isDisconnected;
      },
    );

    const setAgentStateButton = demoUtils.createButton(
      "Change Agent State",
      () => {
        const states = [
          null,
          "analyzing code",
          "refactoring components",
          "running tests",
          "reviewing changes",
          "generating documentation",
        ];
        const currentIndex = states.indexOf(interactiveStatus.agentState);
        const nextIndex = (currentIndex + 1) % states.length;
        interactiveStatus.agentState = states[nextIndex];
      },
    );

    const resetButton = demoUtils.createButton("Reset to Idle", () => {
      interactiveStatus.llmCalls = 0;
      interactiveStatus.toolCalls = [];
      interactiveStatus.agentState = null;
      interactiveStatus.isIdle = true;
      interactiveStatus.isDisconnected = false;
    });

    controlsDiv.appendChild(addLLMCallButton);
    controlsDiv.appendChild(removeLLMCallButton);
    controlsDiv.appendChild(addToolCallButton);
    controlsDiv.appendChild(removeToolCallButton);
    controlsDiv.appendChild(toggleConnectionButton);
    controlsDiv.appendChild(setAgentStateButton);
    controlsDiv.appendChild(resetButton);

    // Assemble the demo
    statusVariationsSection.appendChild(idleStatus);
    statusVariationsSection.appendChild(workingStatus);
    statusVariationsSection.appendChild(heavyWorkingStatus);
    statusVariationsSection.appendChild(disconnectedStatus);
    statusVariationsSection.appendChild(workingDisconnectedStatus);

    const interactiveWrapper = document.createElement("div");
    interactiveWrapper.style.cssText =
      "padding: 10px; border: 1px solid #e1e5e9; border-radius: 6px; background: white;";
    interactiveWrapper.appendChild(interactiveStatus);
    interactiveWrapper.appendChild(controlsDiv);
    interactiveSection.appendChild(interactiveWrapper);

    container.appendChild(statusVariationsSection);
    container.appendChild(interactiveSection);

    // Add some simulation of real activity
    const simulationInterval = setInterval(() => {
      const statusComponents = [
        document.getElementById("working-status") as any,
        document.getElementById("heavy-working-status") as any,
      ].filter(Boolean);

      statusComponents.forEach((statusEl) => {
        if (statusEl && Math.random() > 0.8) {
          // 20% chance to update
          // Simulate some activity by slightly changing the number of calls
          const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
          statusEl.llmCalls = Math.max(0, statusEl.llmCalls + variation);
        }
      });
    }, 2000);

    // Store interval for cleanup
    (container as any).demoInterval = simulationInterval;
  },

  cleanup: async () => {
    // Clear any intervals
    const container = document.getElementById("demo-container");
    if (container && (container as any).demoInterval) {
      clearInterval((container as any).demoInterval);
      delete (container as any).demoInterval;
    }
  },
};

export default demo;
