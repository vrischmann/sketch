import { test, expect } from "@sand4rt/experimental-ct-web";
import { SketchNetworkStatus } from "./sketch-network-status";

test("displays the correct connection status when connected", async ({
  mount,
}) => {
  const component = await mount(SketchNetworkStatus, {
    props: {
      connection: "connected",
      message: "Connected to server",
    },
  });

  await expect(component.locator(".polling-indicator")).toBeVisible();
  await expect(component.locator(".status-text")).toBeVisible();
  await expect(component.locator(".polling-indicator.active")).toBeVisible();
  await expect(component.locator(".status-text")).toContainText(
    "Connected to server",
  );
});

test("displays the correct connection status when disconnected", async ({
  mount,
}) => {
  const component = await mount(SketchNetworkStatus, {
    props: {
      connection: "disconnected",
      message: "Disconnected",
    },
  });

  await expect(component.locator(".polling-indicator")).toBeVisible();
  await expect(component.locator(".polling-indicator.error")).toBeVisible();
});

test("displays the correct connection status when disabled", async ({
  mount,
}) => {
  const component = await mount(SketchNetworkStatus, {
    props: {
      connection: "disabled",
      message: "Disabled",
    },
  });

  await expect(component.locator(".polling-indicator")).toBeVisible();
  await expect(component.locator(".polling-indicator.error")).not.toBeVisible();
  await expect(
    component.locator(".polling-indicator.active"),
  ).not.toBeVisible();
});

test("displays error message when provided", async ({ mount }) => {
  const errorMsg = "Connection error";
  const component = await mount(SketchNetworkStatus, {
    props: {
      connection: "disconnected",
      message: "Disconnected",
      error: errorMsg,
    },
  });

  await expect(component.locator(".status-text")).toBeVisible();
  await expect(component.locator(".status-text")).toContainText(errorMsg);
});
