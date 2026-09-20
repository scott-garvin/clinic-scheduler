import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, label: string) {
  if (await page.getByRole("button", { name: "Toggle navigation" }).isVisible())
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("embedded guide explains validation and queues a confirmed request on the staff dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Patient kiosk");
  await page
    .getByRole("button", { name: "Start check-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find appointment", exact: true })
    .click();
  await expect(page.locator(".inline-step-guidance")).toContainText(
    "Last name is missing",
  );
  await page
    .getByRole("button", { name: "Explain this step", exact: true })
    .click();
  await expect(page.locator(".kiosk-guide-answer")).toContainText(
    "no model call",
  );
  await page
    .getByRole("button", { name: "Request front-desk help", exact: true })
    .click();
  await page.getByLabel("Help category").selectOption("accessibility");
  await expect(page.locator(".help-sent")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Send help request", exact: true })
    .click();
  await expect(page.locator(".help-sent")).toContainText("Help request queued");
  await page.getByRole("button", { name: "Back to front desk" }).click();
  await expect(page.locator(".help-inbox-row")).toHaveCount(1);
  await expect(page.locator(".help-inbox-row")).toContainText(
    "Accessibility or language help",
  );
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.locator(".help-inbox-row")).toHaveCount(0);
  await expect(page.locator(".help-inbox")).toContainText("Recently resolved");
});
test("live LangChain guide receives step codes without entered demographics", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Demo access", exact: true }).click();
  await page
    .getByLabel("Demo access key", { exact: true })
    .fill("test-clera-access-key-not-a-secret");
  await page.getByRole("button", { name: "Connect live demo" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Patient kiosk");
  await page
    .getByRole("button", { name: "Start check-in", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Bauer");
  await page.getByLabel("Date of birth", { exact: true }).fill("1975-03-06");
  const pending = page.waitForRequest((r) =>
    r.url().endsWith("/api/kiosk/help"),
  );
  await page
    .getByRole("button", { name: "Explain this step", exact: true })
    .click();
  const request = await pending;
  expect(request.postDataJSON()).toEqual({
    step: "find",
    issue: "none",
    question: "Explain this step in simple terms",
  });
  await expect(page.locator(".kiosk-guide-answer")).toContainText(
    "Finding your appointment",
  );
  await page
    .getByRole("button", { name: "Request front-desk help", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Send help request", exact: true })
    .click();
  await expect(page.locator(".help-sent")).toBeVisible();
  await page.getByRole("button", { name: "Back to front desk" }).click();
  await expect(page.locator(".help-inbox-row")).toHaveCount(1);
});
test("idle kiosk clears identity fields and assistant drafts before another visitor", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await nav(page, "Patient kiosk");
  await page
    .getByRole("button", { name: "Start check-in", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Bauer");
  await page.getByLabel("Date of birth", { exact: true }).fill("1975-03-06");
  await page
    .getByLabel("What would you like help with?", { exact: true })
    .fill("A private draft");
  await page.clock.fastForward(91000);
  await expect(
    page.getByRole("heading", { name: "A warmer welcome." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("What would you like help with?", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Start check-in", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Last name", exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Date of birth", { exact: true })).toHaveValue(
    "",
  );
});
