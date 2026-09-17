import { expect, test } from "@playwright/test";

const authenticationE2EEnabled = process.env.AUTH_E2E_ENABLED === "true";

test.describe("isolated authentication acceptance", () => {
  test.skip(
    !authenticationE2EEnabled,
    "Set AUTH_E2E_ENABLED=true and isolated Auth credentials to run this suite."
  );

  test("registers, restores a session, and signs out", async ({ page }) => {
    const email = `e2e-${crypto.randomUUID()}@example.test`;

    await page.goto("/sign-up");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("password-for-e2e-testing");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await page.reload();
    await expect(page.getByText("You're signed in")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
