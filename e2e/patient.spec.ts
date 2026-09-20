import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, label: string) {
  if (await page.getByRole("button", { name: "Toggle navigation" }).isVisible())
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function invitePortal(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Demo access", exact: true }).click();
  await page
    .getByLabel("Demo access key", { exact: true })
    .fill("test-clera-access-key-not-a-secret");
  await page.getByRole("button", { name: "Connect live demo" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Patients");
  await page.getByRole("textbox", { name: "Search patients" }).fill("Grace");
  await page.getByRole("button", { name: "Create patient invitation" }).click();
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open patient portal" }).click();
  const portal = await popup;
  await expect(
    portal.getByRole("heading", { name: "Good to see you, Grace." }),
  ).toBeVisible();
  return portal;
}
test("patient sample answers from clinic sources and confirms the shared check-in workflow", async ({
  page,
}) => {
  await page.goto("/?patient=1");
  await page
    .getByRole("button", { name: "Explore as Grace, a fictional patient" })
    .click();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator(".portal-appointment")).toHaveCount(1);
  await page.getByRole("button", { name: "Where do I park?" }).click();
  await expect(page.locator(".patient-answer")).toContainText(
    "free visitor parking",
  );
  await expect(page.locator(".patient-answer a")).toContainText(
    "Planning your visit",
  );
  await page
    .getByRole("button", { name: "I'm here. Check in for this visit" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm patient check-in" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "I'm checking in for this fictional appointment.",
    })
    .check();
  await page.getByRole("button", { name: "Confirm patient check-in" }).click();
  await expect(page.locator(".portal-appointment .status")).toHaveText(
    "checked in",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("staff invitation opens a scoped patient portal with live FAQ and confirmed AI changes", async ({
  page,
}) => {
  const portal = await invitePortal(page);
  expect(new URL(portal.url()).hash).toBe("");
  await expect(portal.locator(".portal-appointment")).toHaveCount(1);
  await expect(portal.locator(".portal-main")).not.toContainText(
    "Jordan Avery",
  );
  await portal.getByRole("button", { name: "Where do I park?" }).click();
  await expect(portal.locator(".patient-answer")).toContainText(
    "free visitor parking",
  );
  await portal
    .getByRole("textbox", { name: "Ask your patient assistant" })
    .fill("Move my visit next week at 10 AM");
  await portal.getByRole("button", { name: "Send patient request" }).click();
  await expect(portal.locator(".patient-approval")).toBeVisible();
  await expect(
    portal.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await portal
    .getByRole("checkbox", {
      name: "I reviewed the appointment details and want this change.",
    })
    .check();
  await portal
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(portal.locator(".patient-approval")).toContainText(
    "Your change is confirmed",
  );
  await portal.reload();
  await expect(
    portal.getByRole("heading", { name: "Good to see you, Grace." }),
  ).toBeVisible();
  await expect(portal.locator(".portal-appointment")).toContainText("10:00 AM");
  await portal.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    portal.getByRole("heading", { name: "Your care, a little easier." }),
  ).toBeVisible();
  await portal.close();
});
test("patient confirmation updates the existing front desk check-in record", async ({
  page,
}) => {
  const portal = await invitePortal(page);
  await portal
    .getByRole("button", { name: "I'm here. Check in for this visit" })
    .click();
  await portal
    .getByRole("checkbox", {
      name: "I'm checking in for this fictional appointment.",
    })
    .check();
  await portal
    .getByRole("button", { name: "Confirm patient check-in" })
    .click();
  await expect(portal.locator(".portal-appointment .status")).toHaveText(
    "checked in",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await nav(page, "Schedule");
  await page.getByRole("button", { name: "Refresh schedule" }).click();
  await page
    .getByRole("textbox", { name: "Search appointments" })
    .fill("Grace");
  await expect(page.locator(".appointment-row")).toContainText("checked in");
  await portal.close();
});
