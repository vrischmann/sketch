import { test, expect } from "@sand4rt/experimental-ct-web";
import { SketchViewModeSelect } from "./sketch-view-mode-select";

test("initializes with 'chat' as the default mode", async ({ mount }) => {
  const component = await mount(SketchViewModeSelect, {});

  // Check the activeMode property
  const activeMode = await component.evaluate(
    (el: SketchViewModeSelect) => el.activeMode,
  );
  expect(activeMode).toBe("chat");

  // Check that the chat button has the active class
  await expect(
    component.locator("#showConversationButton.active"),
  ).toBeVisible();
});

test("displays all four view mode buttons", async ({ mount }) => {
  const component = await mount(SketchViewModeSelect, {});

  // Count the number of buttons
  const buttonCount = await component.locator(".emoji-button").count();
  expect(buttonCount).toBe(4);

  // Check that each button exists
  await expect(component.locator("#showConversationButton")).toBeVisible();
  await expect(component.locator("#showDiffButton")).toBeVisible();
  await expect(component.locator("#showChartsButton")).toBeVisible();
  await expect(component.locator("#showTerminalButton")).toBeVisible();

  // Check the title attributes
  expect(
    await component.locator("#showConversationButton").getAttribute("title"),
  ).toBe("Conversation View");
  expect(await component.locator("#showDiffButton").getAttribute("title")).toBe(
    "Diff View",
  );
  expect(
    await component.locator("#showChartsButton").getAttribute("title"),
  ).toBe("Charts View");
  expect(
    await component.locator("#showTerminalButton").getAttribute("title"),
  ).toBe("Terminal View");
});

test("dispatches view-mode-select event when clicking a mode button", async ({
  mount,
}) => {
  const component = await mount(SketchViewModeSelect, {});

  // Set up promise to wait for the event
  const eventPromise = component.evaluate((el) => {
    return new Promise((resolve) => {
      el.addEventListener(
        "view-mode-select",
        (event) => {
          resolve((event as CustomEvent).detail);
        },
        { once: true },
      );
    });
  });

  // Click the diff button
  await component.locator("#showDiffButton").click();

  // Wait for the event and check its details
  const detail: any = await eventPromise;
  expect(detail.mode).toBe("diff");
});

test("updates the active mode when receiving update-active-mode event", async ({
  mount,
}) => {
  const component = await mount(SketchViewModeSelect, {});

  // Initially should be in chat mode
  let activeMode = await component.evaluate(
    (el: SketchViewModeSelect) => el.activeMode,
  );
  expect(activeMode).toBe("chat");

  // Dispatch the update-active-mode event
  await component.evaluate((el) => {
    const updateEvent = new CustomEvent("update-active-mode", {
      detail: { mode: "diff" },
      bubbles: true,
    });
    el.dispatchEvent(updateEvent);
  });

  // Check that the mode was updated
  activeMode = await component.evaluate(
    (el: SketchViewModeSelect) => el.activeMode,
  );
  expect(activeMode).toBe("diff");

  // Check that the diff button is now active
  await expect(component.locator("#showDiffButton.active")).toBeVisible();
});

test("correctly marks the active button based on mode", async ({ mount }) => {
  const component = await mount(SketchViewModeSelect, {
    props: {
      activeMode: "terminal",
    },
  });

  // Terminal button should be active
  await expect(component.locator("#showTerminalButton.active")).toBeVisible();

  // Other buttons should not be active
  await expect(
    component.locator("#showConversationButton.active"),
  ).not.toBeVisible();
  await expect(component.locator("#showDiffButton.active")).not.toBeVisible();
  await expect(component.locator("#showChartsButton.active")).not.toBeVisible();
});
