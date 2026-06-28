import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("public app exposes Lily Pad mode in the main mode selector", () => {
  assert.ok(htmlSource.includes('option value="lily"'));
  assert.match(htmlSource, /Lily Pad/);
});

test("public app wires Lily Pad controller and core modules", () => {
  for (const expected of [
    "lilyControls",
    "lilyPlayButton",
    "lilySetSourceButton",
    "lilyMappingMode",
    "createLilyNodesFromPads",
    "buildLilyGraph",
    "createLilyPulseEvents",
    "LilyVoiceEngine",
  ]) {
    assert.ok(appSource.includes(expected), `${expected} should be wired in src/app.js`);
  }
});
