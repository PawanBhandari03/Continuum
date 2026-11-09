import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
  });
});

const md = (text: string, name = "notes.md") => ({ name, mimeType: "text/markdown", buffer: Buffer.from(text) });

test("upload notes: a readable Markdown file becomes an ok source with a real unit count", async ({ page }) => {
  await page.goto("/handovers/h_1/connect");
  await page.getByLabel("Upload Notes and docs").setInputFiles(md("# Plan\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird."));
  await expect(page.getByRole("status").filter({ hasText: "read successfully, 4 evidence units" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "notes.md" })).toContainText("4 evidence units");
});

test("upload: the access label chosen is stored (lead only)", async ({ page }) => {
  await page.goto("/handovers/h_1/connect");
  await page.getByLabel("Access label for Notes and docs").selectOption("lead_only");
  await page.getByLabel("Upload Notes and docs").setInputFiles(md("Private mentor remark.", "mentor.md"));
  await expect(page.getByRole("listitem").filter({ hasText: "mentor.md" })).toContainText("Lead only");
});

test("upload failures are visible with a reason, never silent", async ({ page }) => {
  await page.goto("/handovers/h_1/connect");
  const status = page.locator("[aria-live='polite']").filter({ hasText: /could not be used|partly read/ });

  await page.getByLabel("Upload Notes and docs").setInputFiles({ name: "slides.docx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await expect(status).toContainText("Unsupported file type .docx");

  await page.getByLabel("Upload Notes and docs").setInputFiles(md("", "empty.md"));
  await expect(status).toContainText("The file is empty.");

  await page.getByLabel("Upload Chat export").setInputFiles({ name: "export.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(status).toContainText("Not a readable Slack export zip");
  await expect(page.getByRole("listitem").filter({ hasText: "export.json" })).toContainText("Failed");

  await page.getByLabel("Upload Chat export").setInputFiles({ name: "export.zip", mimeType: "application/zip", buffer: Buffer.from("PK") });
  await expect(status).toContainText("partly read");
  await expect(page.getByText(/Some sources are incomplete/)).toBeVisible();
});

test("GitHub connect: a bad URL shows a failed source with a reason", async ({ page }) => {
  await page.goto("/handovers/h_1/connect");
  await page.getByLabel("Repository URL").fill("not-a-url");
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "not-a-url" })).toContainText("Could not parse a GitHub repo URL");
  await expect(page.locator("body")).not.toContainText("github_pat_"); // no token field exists
});
