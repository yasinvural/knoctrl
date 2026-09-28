import { expect, test, type Page } from "@playwright/test";

const authenticationE2EEnabled = process.env.AUTH_E2E_ENABLED === "true";

async function register(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("password-for-e2e-testing");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app$/);
}

test.describe("isolated authentication acceptance", () => {
  test.skip(
    !authenticationE2EEnabled,
    "Set AUTH_E2E_ENABLED=true and isolated Auth credentials to run this suite."
  );

  test("registers, restores a session, and signs out", async ({ page }) => {
    const email = `e2e-${crypto.randomUUID()}@example.test`;

    await register(page, email);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();

    await page.getByRole("button", { name: `Sign out ${email}` }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("manages workspace and folder organization with confirmed deletion", async ({
    page,
  }) => {
    const email = `workspace-${crypto.randomUUID()}@example.test`;

    await register(page, email);
    await page.getByLabel("Workspace name").fill("Research");
    await page.getByRole("button", { name: "Create workspace" }).click();

    const workspaceLink = page.getByRole("link", { name: /Research/ });
    await expect(workspaceLink).toBeVisible();
    await workspaceLink.click();
    await expect(page.getByRole("heading", { name: "Research" })).toBeVisible();

    await page.getByLabel("Folder name").fill("Planning");
    await page.getByRole("button", { name: "Create folder" }).click();
    await expect(page.getByText("Planning", { exact: true })).toBeVisible();

    await page.getByLabel("Folder name").last().fill("Architecture");
    await page.getByRole("button", { name: "Rename folder" }).click();
    await expect(page.getByText("Architecture", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete folder" }).click();
    await expect(page.getByText("Delete Architecture?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Architecture", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete folder" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByText("No folders yet")).toBeVisible();

    await page.getByLabel("Workspace name").fill("Client Research");
    await page.getByRole("button", { name: "Rename workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Client Research" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete workspace" }).click();
    await expect(page.getByText("Delete Client Research?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Client Research" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete workspace" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("No workspaces yet")).toBeVisible();
  });

  test("does not reveal another user's workspace", async ({ page }) => {
    const firstEmail = `workspace-owner-${crypto.randomUUID()}@example.test`;
    const secondEmail = `workspace-viewer-${crypto.randomUUID()}@example.test`;

    await register(page, firstEmail);
    await page.getByLabel("Workspace name").fill("Private Research");
    await page.getByRole("button", { name: "Create workspace" }).click();

    const privateWorkspace = page.getByRole("link", { name: /Private Research/ });
    await expect(privateWorkspace).toBeVisible();
    const privateWorkspacePath = await privateWorkspace.getAttribute("href");

    await page.getByRole("button", { name: `Sign out ${firstEmail}` }).click();
    await register(page, secondEmail);
    await page.goto(privateWorkspacePath ?? "/app");

    await expect(page.getByRole("heading", { name: "Workspace unavailable" })).toBeVisible();
  });
});
