#!/usr/bin/env node
// Reltor smoke driver — logs into the running app and screenshots every
// major page, then reports any console errors. This is the agent's handle
// on the running UI: it proves the React app renders and talks to the API.
//
// Prereqs (both must already be running — see SKILL.md):
//   - API   on http://localhost:4000  (npm run dev:server)
//   - client on http://localhost:5173 (npm run dev:client, Vite proxies /api)
//   - demo account seeded (npm run db:seed) → demo@reltor.app / demo1234
//
// Playwright is provided globally in this container; just run:
//   node .claude/skills/run-reltor/driver.mjs
// (the driver locates the global `playwright` package itself — no NODE_PATH
//  juggling, which ESM ignores for bare imports anyway).
//
// Env overrides:
//   BASE_URL   default http://localhost:5173
//   SHOT_DIR   default /tmp/reltor-shots
//   EMAIL / PASSWORD  default demo@reltor.app / demo1234
//   CHROME     path to chromium (auto-detected under /opt/pw-browsers if unset)

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Resolve `playwright` from wherever it lives (global install in this
// container), then dynamic-import it by absolute path.
function resolvePlaywright() {
  const roots = [];
  try { roots.push(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()); } catch {}
  roots.push(join(process.cwd(), "node_modules"));
  for (const root of roots) {
    try {
      const req = createRequire(join(root, "_.js"));
      return req.resolve("playwright");
    } catch {}
  }
  throw new Error("Could not locate the 'playwright' package (tried global + local node_modules)");
}
const _pw = await import(pathToFileURL(resolvePlaywright()).href);
const chromium = _pw.chromium || _pw.default?.chromium;

const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHOT_DIR = process.env.SHOT_DIR || "/tmp/reltor-shots";
const EMAIL = process.env.EMAIL || "demo@reltor.app";
const PASSWORD = process.env.PASSWORD || "demo1234";

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = "/opt/pw-browsers";
  if (existsSync(root)) {
    for (const d of readdirSync(root)) {
      if (d.startsWith("chromium-")) {
        const p = join(root, d, "chrome-linux", "chrome");
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined; // let Playwright use its default
}

// Sidebar routes to visit + a text marker that proves each page rendered.
const PAGES = [
  { path: "/", name: "dashboard", marker: "Emails Sent" },
  { path: "/campaigns", name: "campaigns", marker: "campaign" },
  { path: "/sequences", name: "sequences", marker: "sequence" },
  { path: "/social", name: "social", marker: "queue" },
  { path: "/contacts", name: "contacts", marker: "contact" },
  { path: "/analytics", name: "analytics", marker: "Open Rate" },
  { path: "/pricing", name: "pricing", marker: "pricing" },
];

const errors = [];

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({
    executablePath: findChrome(),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  // --- Log in (demo creds are pre-filled on the login form) -------------
  console.log(`→ navigating to ${BASE}/login`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Log in")');
  await page.waitForSelector("text=Emails Sent", { timeout: 15000 });
  console.log("✓ logged in — dashboard rendered");

  // --- Walk every major page + screenshot -------------------------------
  for (const p of PAGES) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
    try {
      await page.waitForSelector(`text=/${p.marker}/i`, { timeout: 10000 });
    } catch {
      console.log(`⚠ marker "${p.marker}" not found on ${p.path}`);
    }
    const file = join(SHOT_DIR, `${p.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${p.name.padEnd(10)} → ${file}`);
  }

  // --- One real interactive flow: open the campaign builder modal -------
  // Proves clicks/forms work, not just navigation.
  await page.goto(`${BASE}/campaigns`, { waitUntil: "networkidle" });
  await page.click('button:has-text("New campaign")');
  await page.waitForSelector("text=Email campaign builder", { timeout: 10000 });
  await page.fill('input[placeholder*="Spring New Listing"]', "Smoke Test Campaign");
  await page.screenshot({ path: join(SHOT_DIR, "campaign-builder.png"), fullPage: true });
  console.log(`✓ builder    → ${join(SHOT_DIR, "campaign-builder.png")} (modal opened, name filled)`);

  await browser.close();

  console.log(`\nScreenshots in ${SHOT_DIR}`);
  if (errors.length) {
    console.log(`\n⚠ ${errors.length} console error(s):`);
    for (const e of [...new Set(errors)].slice(0, 10)) console.log("  •", e);
    process.exit(1);
  }
  console.log("✓ no console errors — smoke passed");
}

main().catch((err) => {
  console.error("✗ driver failed:", err.message);
  process.exit(1);
});
