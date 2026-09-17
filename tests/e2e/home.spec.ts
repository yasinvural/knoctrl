import { expect, test } from "@playwright/test";

test("shows public account navigation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Create an account" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("redirects an unauthenticated visitor from the application route", async ({
  page,
}) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
