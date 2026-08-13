import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const netlify = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");

test("web app manifest launches the standalone client console", () => {
  assert.equal(manifest.start_url, "/console.html");
  assert.equal(manifest.display, "standalone");
  assert.match(manifest.name, /现场触发控制台/);
});

test("service worker caches the console shell and local runtime modules", () => {
  for (const asset of [
    "/console.html",
    "/console.css",
    "/favicon.svg",
    "/src/console/app.js",
    "/src/console/profile.js",
    "/src/console/profileStorage.js",
    "/src/console/showModeGuard.js",
    "/src/console/audioEngine.js",
    "/src/console/recognitionSession.js",
    "/src/detection/calibratedColorDetector.js",
    "/src/detection/colorMetrics.js",
    "/src/detection/colorSegmentation.js",
    "/src/detection/padTracker.js",
    "/src/detection/trackColorResolver.js",
  ]) {
    assert.ok(serviceWorker.includes(`"${asset}"`), `${asset} should be cached`);
  }
  assert.match(serviceWorker, /caches\.open/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /client-show-console-v4-real-scene-ten-color/);
});

test("Netlify routes the site root to the console and preserves the legacy studio", () => {
  assert.match(netlify, /from\s*=\s*"\/"[\s\S]*to\s*=\s*"\/console\.html"/);
  assert.match(netlify, /from\s*=\s*"\/studio"[\s\S]*to\s*=\s*"\/index\.html"/);
  assert.match(netlify, /X-Content-Type-Options/);
  assert.match(netlify, /Permissions-Policy/);
});
