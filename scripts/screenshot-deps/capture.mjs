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
    localStorage.setItem("specora:panel:schema", "true");
    localStorage.setItem("specora:panel:history", "false");
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
      const workbench = document.querySelector(".main-panel-client, .collection-sidebar");
      const titleReady = title && /petstore|swagger/i.test(title.textContent ?? "");
      return titleReady || Boolean(workbench);
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(1000);
}

async function capture(name, page, options = {}) {
  const path = join(outDir, name);
  await page.screenshot({ path, ...options });
  console.log(`Wrote ${path}`);
}

async function selectPetstoreRequest(page, labelPattern) {
  const row = page.locator(".collection-tree-request").filter({ hasText: labelPattern }).first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function mockPetstoreResponse(page) {
  const sample = [
    {
      id: 1,
      category: { id: 1, name: "Dogs" },
      name: "doggie",
      photoUrls: ["https://example.com/dog.jpg"],
      tags: [{ id: 1, name: "friendly" }],
      status: "available",
    },
    {
      id: 2,
      name: "fluffy",
      photoUrls: [],
      tags: [],
      status: "pending",
    },
  ];

  await page.route("**/petstore.swagger.io/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sample),
    });
  });
}

async function sendSampleRequest(page) {
  const serverInput = page.locator(".request-url-input, .tryout-url-input").first();
  if (await serverInput.count()) {
    await serverInput.fill("https://petstore.swagger.io/v2");
  }

  await page.getByRole("tab", { name: "Params" }).click();
  const statusCheckbox = page
    .locator(".param-kv-table")
    .filter({ hasText: "Query params" })
    .locator(".param-kv-col-enable input")
    .first();
  if (await statusCheckbox.count()) {
    if (!(await statusCheckbox.isChecked())) {
      await statusCheckbox.check();
    }
    const valueInput = page
      .locator(".param-kv-table")
      .filter({ hasText: "Query params" })
      .locator(".param-kv-input")
      .nth(1);
    if (await valueInput.count()) {
      await valueInput.fill("available");
    }
  }

  const sendButton = page.locator(".request-send-btn, .tryout-send-btn").first();
  await sendButton.click();

  await page.waitForSelector(".json-viewer-tree", { timeout: 20000 });
  await page.waitForTimeout(600);
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
    await selectPetstoreRequest(page, /finds pets by status/i);

    await mockPetstoreResponse(page);

    await capture("ui-overview.png", page);

    const tryoutPanel = page.locator(".client-main-stack").first();
    if (await tryoutPanel.count()) {
      await capture("ui-tryout.png", page, { clip: await tryoutPanel.boundingBox() });
    }

    const insightPanel = page.locator(".operation-insight-panel").first();
    if (await insightPanel.count()) {
      await capture("ui-schemas.png", page, { clip: await insightPanel.boundingBox() });
    }

    await sendSampleRequest(page);

    const responsePanel = page.locator(".tryout-split-response").first();
    if (await responsePanel.count()) {
      const box = await responsePanel.boundingBox();
      if (box) {
        await capture("ui-response-viewer.png", page, { clip: box });
      }
    }

    const workbenchWithResponse = page.locator(".main-panel-client").first();
    if (await workbenchWithResponse.count()) {
      await capture("ui-tryout-response.png", page, {
        clip: await workbenchWithResponse.boundingBox(),
      });
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
