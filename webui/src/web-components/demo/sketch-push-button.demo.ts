import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { MockGitDataService } from "./mock-git-data-service.js";
import "../sketch-push-button.js";

@customElement("sketch-push-button-demo")
export class SketchPushButtonDemo extends LitElement {
  @state()
  private _gitDataService = new MockGitDataService();

  protected createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div
        class="p-4 bg-white rounded-lg shadow-sm border border-gray-200 max-w-md mx-auto"
      >
        <h2 class="text-lg font-semibold mb-4">Push Button Demo</h2>

        <div class="mb-4">
          <p class="text-sm text-gray-600 mb-2">
            Test the push button component:
          </p>
          <sketch-push-button></sketch-push-button>
        </div>

        <div class="text-xs text-gray-500">
          <p>Click the push button to test:</p>
          <ul class="list-disc list-inside mt-1">
            <li>Modal opens with git information</li>
            <li>Input fields can be disabled during loading</li>
            <li>Buttons show individual spinners</li>
            <li>No full modal overwrite during operations</li>
          </ul>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sketch-push-button-demo": SketchPushButtonDemo;
  }
}
