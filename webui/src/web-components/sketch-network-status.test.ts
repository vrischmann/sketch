import { test, expect } from "@sand4rt/experimental-ct-web";
import { SketchNetworkStatus } from "./sketch-network-status";

// Test for the status indicator dot
test("shows status indicator dot when connected", async ({ mount }) => {
  const component = await mount(SketchNetworkStatus, {
    props: {
      connection: "connected",
    },
  });

  // The status container and indicator should be visible
  await expect(component.locator(".status-container")).toBeVisible();
  await expect(component.locator(".status-indicator")).toBeVisible();
  await expect(component.locator(".status-indicator")).toHaveClass(/connected/);
});

// Test that tooltip shows error message when provided
test("includes error in tooltip when provided", async ({ mount }) => {
  const errorMsg = "Connection error";
  const component = await mount(SketchNetworkStatus, {
    props: {
      connection: "disconnected",
      error: errorMsg,
    },
  });

  await expect(component.locator(".status-indicator")).toBeVisible();
  await expect(component.locator(".status-indicator")).toHaveAttribute(
    "title",
    "Connection status: disconnected - Connection error",
  );
});
