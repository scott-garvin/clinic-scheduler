import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, label: string) {
  if (await page.getByRole("button", { name: "Toggle navigation" }).isVisible())
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("schedule, booking, status workflow, persistence, CSV and reset", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Keep the day moving." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Patient", { exact: true }).selectOption("p1");
  await dialog.getByLabel("Available time").selectOption("660");
  await dialog
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Jordan");
  await expect(page.locator(".appointment-row")).toHaveCount(2);
  await page.locator(".appointment-row").filter({ hasText: "11:00" }).click();
  for (const action of ["Check in", "Mark roomed", "Complete visit"])
    await dialog.getByRole("button", { name: action, exact: true }).click();
  await expect(dialog.locator(".status")).toHaveText("completed");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Jordan");
  await expect(page.locator(".appointment-row")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/clera-.*csv/);
  if (await page.getByRole("button", { name: "Toggle navigation" }).isVisible())
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Reset my session" }).click();
  await page
    .getByRole("button", { name: "Reset session", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Jordan");
  await expect(page.locator(".appointment-row")).toHaveCount(1);
});
test("manual reschedule and cancellation with activity history", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Grace");
  await page.locator(".appointment-row").click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Available time").selectOption("660");
  await dialog
    .getByLabel("Reason for rescheduling")
    .fill("Patient requested later");
  await dialog.getByRole("button", { name: "Save new time" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".appointment-row")).toContainText("11:00");
  await page.locator(".appointment-row").click();
  await page
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await dialog.getByLabel("Cancellation reason").fill("Demo cancellation");
  await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(dialog.locator(".status")).toHaveText("cancelled");
  await expect(dialog).toContainText("Moved from");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await nav(page, "Activity");
  await expect(page.locator(".activity-panel")).toContainText(
    "Demo cancellation",
  );
});
test("guided proposal requires approval and kiosk updates staff schedule", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Try a guided reschedule" }).click();
  const card = page.locator(".approval-card");
  await expect(
    card.getByRole("button", { name: "Approve change" }),
  ).toBeDisabled();
  await expect(
    page.locator(".appointment-row").filter({ hasText: "Grace" }),
  ).toHaveCount(1);
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Approve change" }).click();
  await expect(card).toContainText("Change approved");
  await expect(
    page.locator(".appointment-row").filter({ hasText: "Grace" }),
  ).toHaveCount(0);
  await nav(page, "Patient kiosk");
  await page
    .getByRole("button", { name: "Start check-in", exact: true })
    .click();
  await page.getByRole("button", { name: "Use these demo details" }).click();
  await page.getByRole("button", { name: "Find appointment" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm check-in" }).click();
  await expect(
    page.getByRole("heading", { name: "You're checked in." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "See the updated schedule" }).click();
  await expect(
    page.locator(".appointment-row").filter({ hasText: "Diego" }),
  ).toContainText("checked in");
});
test("live backend proposal, approval, reconnect and responsive calendar", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Demo access", exact: true }).click();
  await page
    .getByLabel("Demo access key", { exact: true })
    .fill("test-clera-access-key-not-a-secret");
  await page.getByRole("button", { name: "Connect live demo" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Grace");
  await page.locator(".appointment-row").click();
  await page.getByRole("button", { name: "Ask assistant" }).click();
  await page
    .getByRole("textbox", { name: "Scheduling request" })
    .fill(
      "Move this appointment next week at 10 AM because the patient requested it.",
    );
  await page.getByRole("button", { name: "Send scheduling request" }).click();
  const card = page.locator(".approval-card");
  await expect(card).toBeVisible();
  await expect(page.locator(".appointment-row")).toHaveCount(1);
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Approve change" }).click();
  await expect(card).toContainText("Change approved");
  await page.reload();
  await page.getByRole("button", { name: "Demo access", exact: true }).click();
  await page
    .getByLabel("Demo access key", { exact: true })
    .fill("test-clera-access-key-not-a-secret");
  await page.getByRole("button", { name: "Connect live demo" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Grace");
  await expect(page.locator(".appointment-row")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search appointments" }).fill("");
  await page.getByRole("button", { name: "Provider calendar" }).click();
  await expect(page.locator(".provider-calendar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
