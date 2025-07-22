/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Demo module for sketch-diff-range-picker component
 */

import { DemoModule } from "./demo-framework/types";
import { demoUtils } from "./demo-fixtures/index";
import { MockGitDataService } from "./mock-git-data-service";

const demo: DemoModule = {
  title: "Diff Range Picker Demo",
  description: "Component for selecting commit ranges for diff views",
  imports: ["../sketch-diff-range-picker"],

  setup: async (container: HTMLElement) => {
    // Create demo sections
    const basicSection = demoUtils.createDemoSection(
      "Basic Range Picker",
      "Select commit ranges for diff views with dropdown interface",
    );

    const statusSection = demoUtils.createDemoSection(
      "Range Selection Status",
      "Shows the currently selected range and events",
    );

    // Create mock git service
    const mockGitService = new MockGitDataService();

    // Create the component
    const rangePickerElement = document.createElement(
      "sketch-diff-range-picker",
    );
    rangePickerElement.style.cssText = `
      width: 100%;
      max-width: 800px;
      margin: 20px 0;
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: white;
    `;

    // Set up the git service
    (rangePickerElement as any).gitService = mockGitService;

    // Create status display
    const statusDisplay = document.createElement("div");
    statusDisplay.style.cssText = `
      padding: 12px;
      margin: 16px 0;
      background: var(--demo-fixture-section-bg);
      border-radius: 6px;
      border: 1px solid #e9ecef;
      font-family: monospace;
      font-size: 14px;
      line-height: 1.4;
    `;
    statusDisplay.innerHTML = `
      <div><strong>Status:</strong> No range selected</div>
      <div><strong>Events:</strong> None</div>
    `;

    // Listen for range change events
    rangePickerElement.addEventListener("range-change", (event: any) => {
      const range = event.detail.range;
      const fromShort = range.from ? range.from.substring(0, 7) : "N/A";
      const toShort = range.to ? range.to.substring(0, 7) : "Uncommitted";

      statusDisplay.innerHTML = `
        <div><strong>Status:</strong> Range selected</div>
        <div><strong>From:</strong> ${fromShort}</div>
        <div><strong>To:</strong> ${toShort}</div>
        <div><strong>Events:</strong> range-change fired at ${new Date().toLocaleTimeString()}</div>
      `;
    });

    // Add components to sections
    basicSection.appendChild(rangePickerElement);
    statusSection.appendChild(statusDisplay);

    // Add sections to container
    container.appendChild(basicSection);
    container.appendChild(statusSection);

    // Add some demo instructions
    const instructionsDiv = document.createElement("div");
    instructionsDiv.style.cssText = `
      margin: 20px 0;
      padding: 16px;
      background: var(--demo-instruction-bg);
      border-radius: 6px;
      border-left: 4px solid #2196f3;
    `;
    instructionsDiv.innerHTML = `
      <h3 style="margin: 0 0 8px 0; color: #1976d2;">Demo Instructions:</h3>
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li>Click on the dropdown to see available commits</li>
        <li>Select different commits to see range changes</li>
        <li>The component defaults to diffing against uncommitted changes</li>
        <li>Watch the status display for real-time event updates</li>
      </ul>
    `;
    container.appendChild(instructionsDiv);
  },

  cleanup: () => {
    // Clean up any event listeners or resources if needed
    console.log("Cleaning up sketch-diff-range-picker demo");
  },
};

export default demo;
