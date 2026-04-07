import { test, expect } from "@playwright/test";

test("app loads and shows the chat interface", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Interactive Chat");
  await expect(page.locator(".chat-header")).toHaveText("Interactive Chat");
  await expect(page.locator(".chat-input-bar input")).toBeVisible();
  await expect(page.locator(".chat-input-bar button")).toHaveText("Send");
});

test("send button is disabled when input is empty", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".chat-input-bar button")).toBeDisabled();
});

test("can send a message and receive widgets", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Hello");
  await page.locator(".chat-input-bar button").click();

  // User message should appear
  await expect(page.locator(".message-user .message-bubble")).toHaveText(
    "Hello"
  );

  // Widgets should appear with data-widget-id attributes
  await expect(page.locator("[data-widget-id]").first()).toBeVisible({
    timeout: 10000,
  });

  // Should contain text block from mock response
  await expect(page.locator(".block-text").first()).toBeVisible();
});

test("can send message with Enter key", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Hi there");
  await input.press("Enter");

  await expect(page.locator(".message-user .message-bubble")).toHaveText(
    "Hi there"
  );
  await expect(page.locator("[data-widget-id]").first()).toBeVisible({
    timeout: 10000,
  });
});

test("input is disabled while loading", async ({ page }) => {
  // Delay the API response so we can observe the disabled state
  await page.route("**/api/chat", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.fallback();
  });

  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Hello");
  await input.press("Enter");

  // Input should be disabled while waiting for the delayed response
  await expect(input).toBeDisabled();

  // After response completes, input should be enabled again
  await expect(page.locator("[data-widget-id]").first()).toBeVisible({
    timeout: 10000,
  });
  await expect(input).toBeEnabled();
});

test("shows loading indicator before response arrives", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Hello");
  await input.press("Enter");

  // Loading indicator should briefly appear (may be very fast with mock)
  // After response, it should be gone
  await expect(page.locator("[data-widget-id]").first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator(".loading-indicator")).not.toBeVisible();
});

test("widgets have stable IDs from mock response", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Hello");
  await input.press("Enter");

  await expect(page.locator('[data-widget-id="welcome"]')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('[data-widget-id="quick-actions"]')).toBeVisible({
    timeout: 10000,
  });
});

test("renders card blocks with nested content", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Show me something");
  await input.press("Enter");

  await expect(page.locator(".block-card").first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator(".block-card-title").first()).toHaveText(
    "Quick Actions"
  );
  await expect(page.locator(".block-button").first()).toBeVisible();
});

test("widget interaction does NOT show synthetic user message", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Start");
  await input.press("Enter");

  await expect(page.locator(".block-button").first()).toBeVisible({
    timeout: 10000,
  });

  // Click a button — triggers widget interaction
  await page.locator(".block-button").first().click();

  // Should NOT create a new user message
  const userMessages = page.locator(".message-user .message-bubble");
  await expect(userMessages).toHaveCount(1);

  // Widgets should still be present (updated in-place)
  await expect(page.locator("[data-widget-id]").first()).toBeVisible({
    timeout: 10000,
  });
});

test("widget updates in-place on interaction — no synthetic message, no duplicates", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Hello");
  await input.press("Enter");

  // First response (user message): welcome + quick-actions from fallback
  const welcomeWidget = page.locator('[data-widget-id="welcome"]');
  await expect(welcomeWidget).toBeVisible({ timeout: 10000 });
  await expect(welcomeWidget.locator(".block-text")).toContainText("Hello!");

  // Click button — synthetic message "Clicked ..." triggers the interaction route
  await page.locator(".block-button").first().click();

  // Interaction route returns only welcome widget with different text
  await expect(welcomeWidget.locator(".block-text")).toContainText(
    "Here's what I can do for you!",
    { timeout: 10000 }
  );

  // quick-actions was not in the interaction response, so it stays unchanged
  await expect(
    page.locator('[data-widget-id="quick-actions"]')
  ).toBeVisible();

  // Still only 1 user message (no synthetic "Clicked" message shown)
  await expect(page.locator(".message-user .message-bubble")).toHaveCount(1);

  // Still only 2 widget elements (no duplicates)
  await expect(page.locator("[data-widget-id]")).toHaveCount(2);
});

test("widgets are dimmed while loading", async ({ page }) => {
  // Delay the API response so we can observe the dimmed state
  let requestCount = 0;
  await page.route("**/api/chat", async (route) => {
    requestCount++;
    if (requestCount >= 2) {
      // Only delay the interaction response, not the initial message
      await new Promise((r) => setTimeout(r, 500));
    }
    await route.fallback();
  });

  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Show controls");
  await input.press("Enter");

  // Wait for controls to appear
  const controlsWidget = page.locator('[data-widget-id="controls"]');
  await expect(controlsWidget.locator(".block-toggle")).toBeVisible({ timeout: 10000 });

  // Trigger an interaction — click the toggle
  await controlsWidget.locator(".block-toggle input").click();

  // Widgets should be dimmed during loading
  await expect(page.locator(".widget-dimmed").first()).toBeVisible();

  // After response completes, widgets should no longer be dimmed
  await expect(page.locator(".widget-dimmed")).toHaveCount(0, {
    timeout: 10000,
  });
});

test("toggle can be unchecked and retains local state", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Show controls");
  await input.press("Enter");

  // Wait for toggle to appear (initially checked)
  const toggle = page.locator(".block-toggle input");
  await expect(toggle).toBeVisible({ timeout: 10000 });
  await expect(toggle).toBeChecked();

  // Uncheck it
  await toggle.click();

  // Should be unchecked immediately (local state)
  await expect(toggle).not.toBeChecked();

  // After LLM responds, the text should update
  const controlsWidget = page.locator('[data-widget-id="controls"]');
  await expect(controlsWidget.locator(".block-text")).toContainText(
    "Dark mode disabled",
    { timeout: 10000 }
  );
});

test("select retains local value after interaction", async ({ page }) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");
  await input.fill("Show controls");
  await input.press("Enter");

  // Wait for select to appear inside controls widget
  const controlsWidget = page.locator('[data-widget-id="controls"]');
  const select = controlsWidget.locator(".block-select select");
  await expect(select).toBeVisible({ timeout: 10000 });
  await expect(select).toHaveValue("blue");

  // Change to green
  await select.selectOption("green");

  // Should show green immediately (local state)
  await expect(select).toHaveValue("green");

  // After LLM responds, the text should update
  await expect(controlsWidget.locator(".block-text")).toContainText(
    "Theme changed to green",
    { timeout: 10000 }
  );
});

test("multi-turn: second user message adds new display items", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.locator(".chat-input-bar input");

  // First message
  await input.fill("First message");
  await input.press("Enter");
  await expect(page.locator("[data-widget-id]").first()).toBeVisible({
    timeout: 10000,
  });

  // Second message
  await input.fill("Second message");
  await input.press("Enter");

  // Should have 2 user message bubbles
  await expect(page.locator(".message-user .message-bubble")).toHaveCount(2, {
    timeout: 10000,
  });
});
