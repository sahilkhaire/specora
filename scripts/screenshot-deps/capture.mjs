/**
 * Capture README UI screenshots using the Petstore OpenAPI spec.
 * Requires: dev server on http://localhost:5173 (npm run dev:web)
 *
 * Run: npm install (in this folder), then `node capture.mjs`
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const specPath = join(root, "docs/fixtures/petstore.swagger.json");
const outDir = join(root, "docs/images");
const baseUrl = process.env.SPECORA_SCREENSHOT_BASE_URL ?? "http://localhost:5173";
const specText = readFileSync(specPath, "utf8");

mkdirSync(outDir, { recursive: true });

async function prepareDemoWorkspace(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("specora-theme-mode", "light");
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("heading", { name: /add your api specification/i }).waitFor({
    timeout: 15000,
  });

  await page.getByRole("tab", { name: "Paste" }).click();
  await page.locator(".spec-loader-panel textarea").fill(specText);
  await page.getByRole("button", { name: /parse pasted spec/i }).click();

  await page.waitForSelector(".spec-loader-overlay", { state: "hidden", timeout: 30000 });
}

async function waitForSpecLoaded(page) {
  await page.waitForFunction(
    () => {
      const title = document.querySelector(".app-top-header-api-title");
      return title && /petstore|swagger/i.test(title.textContent ?? "");
    },
    { timeout: 25000 }
  );
  await page.waitForTimeout(800);
}

async function capture(name, page, options = {}) {
  const path = join(outDir, name);
  await page.screenshot({ path, ...options });
  console.log(`Wrote ${path}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

try {
  await prepareDemoWorkspace(page);
  await waitForSpecLoaded(page);

  const workbenchReady = await page.locator(".main-panel-client").count();
  if (workbenchReady > 0) {
    const getPet = page.getByText("Finds Pets by status", { exact: false }).first();
    if (await getPet.count()) {
      await getPet.click();
      await page.waitForTimeout(600);
    }

    await capture("ui-overview.png", page);

    const tryoutPanel = page.locator(".client-main-stack").first();
    if (await tryoutPanel.count()) {
      await capture("ui-tryout.png", page, { clip: await tryoutPanel.boundingBox() });
    }

    const insightPanel = page.locator(".operation-insight-panel").first();
    if (await insightPanel.count()) {
      await capture("ui-schemas.png", page, { clip: await insightPanel.boundingBox() });
    }
  } else {
    await capture("ui-overview.png", page);
    const tagHeader = page.locator(".tag-header").first();
    if (await tagHeader.count()) {
      await tagHeader.click();
      await page.locator(".operation-row").first().click();
      await page.waitForTimeout(400);
      await capture("ui-operation-detail.png", page);
    }
  }
} finally {
  await browser.close();
}

console.log("Screenshot capture complete.");
