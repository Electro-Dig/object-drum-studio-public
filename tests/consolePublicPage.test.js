import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../console.html", import.meta.url), "utf8");

test("client console exposes the complete remote-setup workflow", () => {
  for (const id of [
    "consoleApp",
    "systemStatus",
    "cameraVideo",
    "stageCanvas",
    "processCanvas",
    "startCameraButton",
    "armAudioButton",
    "mappingModeSelect",
    "slotList",
    "profileImportInput",
    "exportProfileButton",
    "enterShowModeButton",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `${id} should exist in console.html`);
  }
});

test("client console exposes a reduced show-mode action bar", () => {
  for (const id of [
    "showModePanel",
    "liveToggleButton",
    "runtimeResetButton",
    "showMasterGainInput",
    "exitShowModeButton",
    "triggerLog",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `${id} should exist in console.html`);
  }
});

test("client console loads its own stylesheet and application module", () => {
  assert.match(html, /href="\.\/console\.css"/);
  assert.match(html, /src="\.\/src\/console\/app\.js"/);
  assert.doesNotMatch(html, /src="\.\/src\/app\.js"/);
});
