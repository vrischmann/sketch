/**
 * Demo module for sketch-view-mode-select component
 */

import { DemoModule } from "./demo-framework/types";
import {
  demoUtils,
  sampleViewModeConfigs,
  viewModeScenarios,
  applyViewModeConfig,
  createViewModeTestButtons,
} from "./demo-fixtures/index";

const demo: DemoModule = {
  title: "View Mode Select Demo",
  description:
    "Interactive tab navigation for switching between chat, diff, and terminal views",
  imports: ["../sketch-view-mode-select"],
  styles: ["/dist/tailwind.css"],

  setup: async (container: HTMLElement) => {
    // Create demo sections
    const basicSection = demoUtils.createDemoSection(
      "Basic View Mode Selector",
      "Click buttons to switch between different views",
    );

    const scenariosSection = demoUtils.createDemoSection(
      "Different Scenarios",
      "Pre-configured scenarios showing various diff stats and active modes",
    );

    const interactiveSection = demoUtils.createDemoSection(
      "Interactive Testing",
      "Test different configurations and watch the component update",
    );

    // Basic view mode selector
    const basicContainer = document.createElement("div");
    basicContainer.className = "@container";

    const basicSelector = document.createElement(
      "sketch-view-mode-select",
    ) as any;
    basicSelector.id = "basic-selector";
    applyViewModeConfig(basicSelector, sampleViewModeConfigs.basic);

    basicContainer.appendChild(basicSelector);

    // Status display for basic selector
    const basicStatus = document.createElement("div");
    basicStatus.id = "basic-status";
    basicStatus.style.cssText = `
      margin-top: 15px;
      padding: 10px;
      background: #f6f8fa;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
    `;

    const updateBasicStatus = () => {
      basicStatus.innerHTML = `
        <strong>Current State:</strong><br>
        Active Mode: <code>${basicSelector.activeMode}</code><br>
        Diff Stats: <code>+${basicSelector.diffLinesAdded} -${basicSelector.diffLinesRemoved}</code>
      `;
    };
    updateBasicStatus();

    // Listen for view mode changes
    basicSelector.addEventListener("view-mode-select", (event: CustomEvent) => {
      console.log("View mode changed:", event.detail);
      basicSelector.activeMode = event.detail.mode;
      updateBasicStatus();
    });

    // Create scenario examples
    const scenarioContainer = document.createElement("div");
    scenarioContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
      margin-top: 15px;
    `;

    viewModeScenarios.forEach((scenario) => {
      const scenarioCard = document.createElement("div");
      scenarioCard.style.cssText = `
        padding: 15px;
        border: 1px solid #d0d7de;
        border-radius: 8px;
        background: white;
      `;

      const scenarioTitle = document.createElement("h4");
      scenarioTitle.textContent = scenario.name;
      scenarioTitle.style.cssText = "margin: 0 0 5px 0; color: #24292f;";

      const scenarioDesc = document.createElement("p");
      scenarioDesc.textContent = scenario.description;
      scenarioDesc.style.cssText =
        "margin: 0 0 10px 0; color: #656d76; font-size: 14px;";

      const scenarioWrapper = document.createElement("div");
      scenarioWrapper.className = "@container";

      const scenarioSelector = document.createElement(
        "sketch-view-mode-select",
      ) as any;
      applyViewModeConfig(scenarioSelector, scenario.config);

      scenarioWrapper.appendChild(scenarioSelector);

      scenarioCard.appendChild(scenarioTitle);
      scenarioCard.appendChild(scenarioDesc);
      scenarioCard.appendChild(scenarioWrapper);
      scenarioContainer.appendChild(scenarioCard);
    });

    // Interactive testing component
    const interactiveSelectorContainer = document.createElement("div");
    interactiveSelectorContainer.className = "@container";

    const interactiveSelector = document.createElement(
      "sketch-view-mode-select",
    ) as any;
    interactiveSelector.id = "interactive-selector";
    applyViewModeConfig(interactiveSelector, sampleViewModeConfigs.basic);

    interactiveSelectorContainer.appendChild(interactiveSelector);

    // Status display for interactive selector
    const interactiveStatus = document.createElement("div");
    interactiveStatus.id = "interactive-status";
    interactiveStatus.style.cssText = basicStatus.style.cssText;

    const updateInteractiveStatus = () => {
      interactiveStatus.innerHTML = `
        <strong>Interactive Component State:</strong><br>
        Active Mode: <code>${interactiveSelector.activeMode}</code><br>
        Diff Lines Added: <code>${interactiveSelector.diffLinesAdded}</code><br>
        Diff Lines Removed: <code>${interactiveSelector.diffLinesRemoved}</code><br>
        <em>Click scenario buttons above to test different configurations</em>
      `;
    };
    updateInteractiveStatus();

    // Listen for view mode changes on interactive selector
    interactiveSelector.addEventListener(
      "view-mode-select",
      (event: CustomEvent) => {
        console.log("Interactive view mode changed:", event.detail);
        interactiveSelector.activeMode = event.detail.mode;
        updateInteractiveStatus();
      },
    );

    // Custom controls for interactive testing
    const customControls = document.createElement("div");
    customControls.style.cssText = `
      margin: 15px 0;
      padding: 15px;
      background: #f6f8fa;
      border-radius: 6px;
    `;

    const addLinesButton = demoUtils.createButton("Add +5 Lines", () => {
      interactiveSelector.diffLinesAdded += 5;
      interactiveSelector.requestUpdate();
      updateInteractiveStatus();
    });

    const removeLinesButton = demoUtils.createButton("Add -3 Lines", () => {
      interactiveSelector.diffLinesRemoved += 3;
      interactiveSelector.requestUpdate();
      updateInteractiveStatus();
    });

    const clearDiffButton = demoUtils.createButton("Clear Diff", () => {
      interactiveSelector.diffLinesAdded = 0;
      interactiveSelector.diffLinesRemoved = 0;
      interactiveSelector.requestUpdate();
      updateInteractiveStatus();
    });

    const randomDiffButton = demoUtils.createButton("Random Diff", () => {
      interactiveSelector.diffLinesAdded = Math.floor(Math.random() * 100) + 1;
      interactiveSelector.diffLinesRemoved = Math.floor(Math.random() * 50) + 1;
      interactiveSelector.requestUpdate();
      updateInteractiveStatus();
    });

    customControls.appendChild(addLinesButton);
    customControls.appendChild(removeLinesButton);
    customControls.appendChild(clearDiffButton);
    customControls.appendChild(randomDiffButton);

    // Assemble the demo
    basicSection.appendChild(basicContainer);
    basicSection.appendChild(basicStatus);

    scenariosSection.appendChild(scenarioContainer);

    interactiveSection.appendChild(interactiveSelectorContainer);

    // Add test buttons for interactive section
    createViewModeTestButtons(interactiveSelector, interactiveSection);

    interactiveSection.appendChild(customControls);
    interactiveSection.appendChild(interactiveStatus);

    container.appendChild(basicSection);
    container.appendChild(scenariosSection);
    container.appendChild(interactiveSection);

    // Add container queries responsive testing section
    const responsiveSection = demoUtils.createDemoSection(
      "Container Query Responsive Testing",
      "Demonstrates how the component behaves at different container sizes using Tailwind container queries",
    );

    // Create explanation text
    const explanation = document.createElement("p");
    explanation.style.cssText = "margin: 10px 0; color: #666; font-size: 14px;";
    explanation.innerHTML = `
      <strong>Container Queries:</strong> The component now uses Tailwind <code>@container</code> queries instead of viewport media queries.<br>
      This allows different sized containers to show different responsive behaviors simultaneously.
    `;
    responsiveSection.appendChild(explanation);

    // Create different sized container examples
    const containerExamples = [
      {
        title: "Extra Wide Container (700px)",
        description: "Shows full text labels and complete layout",
        width: "700px",
        config: sampleViewModeConfigs.largeDiff,
        containerClass: "w-[700px]",
        borderColor: "border-green-500",
      },
      {
        title: "Very Narrow Container (250px)",
        description: "Shows icons only (text hidden due to container query)",
        width: "250px",
        config: sampleViewModeConfigs.terminalActive,
        containerClass: "w-[250px]",
        borderColor: "border-orange-500",
      },
    ];

    const examplesContainer = document.createElement("div");
    examplesContainer.style.cssText =
      "display: flex; flex-direction: column; gap: 20px; margin: 20px 0;";

    containerExamples.forEach((example, index) => {
      // Create container wrapper
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        border: 2px solid;
        border-radius: 8px;
        padding: 15px;
        background: #f9f9f9;
      `;
      wrapper.className = example.borderColor;

      // Create title and description
      const header = document.createElement("div");
      header.style.cssText = "margin-bottom: 10px;";
      header.innerHTML = `
        <h4 style="margin: 0 0 5px 0; font-weight: 600; color: #333;">${example.title}</h4>
        <p style="margin: 0; font-size: 14px; color: #666;">${example.description}</p>
      `;
      wrapper.appendChild(header);

      // Create constrained container for the component
      const componentContainer = document.createElement("div");
      componentContainer.className = "@container";
      componentContainer.style.cssText = `
        width: ${example.width};
        border: 1px dashed #ccc;
        padding: 10px;
        background: white;
        border-radius: 4px;
      `;

      // Create the component
      const component = document.createElement(
        "sketch-view-mode-select",
      ) as any;
      applyViewModeConfig(component, example.config);

      componentContainer.appendChild(component);
      wrapper.appendChild(componentContainer);
      examplesContainer.appendChild(wrapper);
    });

    responsiveSection.appendChild(examplesContainer);

    // Add interactive container size testing
    const containerTestSection = document.createElement("div");
    containerTestSection.style.cssText =
      "margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;";

    const interactiveTitle = document.createElement("h4");
    interactiveTitle.textContent = "Interactive Container Size Testing";
    interactiveTitle.style.cssText = "margin: 0 0 10px 0; font-weight: 600;";

    const interactiveDesc = document.createElement("p");
    interactiveDesc.textContent =
      "Use the buttons below to change the container size and see the responsive behavior in real-time.";
    interactiveDesc.style.cssText =
      "margin: 0 0 15px 0; color: #666; font-size: 14px;";

    // Create interactive container
    const interactiveContainer = document.createElement("div");
    interactiveContainer.className = "@container";
    interactiveContainer.style.cssText = `
      border: 2px solid #007acc;
      border-radius: 8px;
      padding: 15px;
      background: #f0f8ff;
      transition: width 0.3s ease;
      width: 700px;
    `;

    // Create interactive component
    const interactiveComponent = document.createElement(
      "sketch-view-mode-select",
    ) as any;
    applyViewModeConfig(interactiveComponent, sampleViewModeConfigs.largeDiff);

    // Size info display
    const sizeInfo = document.createElement("div");
    sizeInfo.style.cssText =
      "margin-bottom: 10px; font-family: monospace; font-size: 12px; color: #333;";
    sizeInfo.textContent = "Current container width: 700px";

    interactiveContainer.appendChild(sizeInfo);
    interactiveContainer.appendChild(interactiveComponent);

    // Control buttons
    const controlButtons = document.createElement("div");
    controlButtons.style.cssText =
      "margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;";

    const sizes = [
      { label: "Extra Wide (700px)", width: "700px" },
      { label: "Medium (400px)", width: "400px" },
      { label: "Very Narrow (250px)", width: "250px" },
    ];

    sizes.forEach((size) => {
      const button = demoUtils.createButton(size.label, () => {
        interactiveContainer.style.width = size.width;
        sizeInfo.textContent = `Current container width: ${size.width}`;
      });
      controlButtons.appendChild(button);
    });

    containerTestSection.appendChild(interactiveTitle);
    containerTestSection.appendChild(interactiveDesc);
    containerTestSection.appendChild(interactiveContainer);
    containerTestSection.appendChild(controlButtons);

    responsiveSection.appendChild(containerTestSection);
    container.appendChild(responsiveSection);
  },

  cleanup: async () => {
    // Clean up any event listeners or intervals if needed
    console.log("Cleaning up sketch-view-mode-select demo");
  },
};

export default demo;
