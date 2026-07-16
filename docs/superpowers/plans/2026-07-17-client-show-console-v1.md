# Client Show Console V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a standalone client-facing camera-to-sound show console with guided setup, minimal show controls, portable profiles, and overlapping once-per-entry audio.

**Architecture:** Keep the original studio app intact and add a separate console entry point. Reuse color segmentation and pad tracking, but implement profile, entry gating, sound routing, persistence, native audio, and UI orchestration as focused console modules.

**Tech Stack:** Static HTML/CSS, ES modules, Node built-in test runner, Canvas 2D, MediaDevices, Web Audio API, IndexedDB, Service Worker, Netlify.

---

### Task 1: Profile and trigger domain

**Files:**
- Create: `src/console/profile.js`
- Create: `src/console/entryGate.js`
- Create: `src/console/soundSelector.js`
- Create: `tests/consoleProfile.test.js`
- Create: `tests/consoleTrigger.test.js`

- [ ] **Step 1: Write failing profile tests**

Test that `createDefaultProfile()` exposes exactly six enabled slots, `normalizeProfile()` clamps unsafe values, `activeColorRules()` returns six rules in six-color mode and one rule in random mode, and `validateShowPackage()` rejects unsupported schemas.

- [ ] **Step 2: Run profile tests and verify RED**

Run: `node --test tests/consoleProfile.test.js`

Expected: failure because `src/console/profile.js` does not exist.

- [ ] **Step 3: Implement the profile API**

Export these stable interfaces:

```js
export const CONSOLE_SCHEMA_VERSION = 1;
export const MAPPING_MODES = Object.freeze({
  SIX_COLOR: "six-color",
  SAME_COLOR_RANDOM: "same-color-random",
});
export function createDefaultProfile() {}
export function normalizeProfile(value) {}
export function activeColorRules(profile) {}
export function validateShowPackage(value) {}
```

Each slot has `id`, `label`, `enabled`, `gain`, `fallbackVoice`, `soundName`, and a normalized `colorRule` whose `instrument` equals the slot ID.

- [ ] **Step 4: Run profile tests and verify GREEN**

Run: `node --test tests/consoleProfile.test.js`

Expected: all profile tests pass.

- [ ] **Step 5: Write failing trigger tests**

Cover new IDs, held IDs, removal and re-entry, simultaneous entries, six-color routing by rule ID, and deterministic random routing with an injected random function.

- [ ] **Step 6: Run trigger tests and verify RED**

Run: `node --test tests/consoleTrigger.test.js`

Expected: failure because trigger modules do not exist.

- [ ] **Step 7: Implement trigger modules**

`EntryGate.update(pads)` returns pads whose IDs were not active in the prior update. `selectSoundSlot({ profile, pad, random })` maps the pad rule to a slot or randomly selects an enabled slot in random mode.

- [ ] **Step 8: Run trigger tests and the full suite**

Run: `npm.cmd test`

Expected: all legacy and new tests pass.

### Task 2: Portable local sample storage and audio engine

**Files:**
- Create: `src/console/sampleStore.js`
- Create: `src/console/audioEngine.js`
- Create: `tests/consolePackage.test.js`

- [ ] **Step 1: Write failing package serialization tests**

Test `buildShowPackage(profile, samples)` and `readShowPackage(json)` using data URL strings, including invalid JSON and unsupported schema cases.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/consolePackage.test.js`

Expected: failure because package helpers do not exist.

- [ ] **Step 3: Implement package helpers and IndexedDB adapter**

Export:

```js
export function buildShowPackage(profile, sampleDataBySlot = {}) {}
export function readShowPackage(text) {}
export class SampleStore {
  async get(slotId) {}
  async set(slotId, record) {}
  async delete(slotId) {}
  async entries() {}
}
```

The IndexedDB database is `object-drum-show-console`, version 1, with one `samples` object store keyed by slot ID.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/consolePackage.test.js`

Expected: all package tests pass.

- [ ] **Step 5: Implement native polyphonic audio**

Create `ConsoleAudioEngine` with `arm()`, `loadSample(slotId, data)`, `removeSample(slotId)`, `setMasterGain(value)`, and `trigger(slot, velocity)`. Every sample trigger creates a new buffer source. When no decoded sample exists, play a short native synthesized fallback selected by `fallbackVoice`.

- [ ] **Step 6: Run full suite**

Run: `npm.cmd test`

Expected: all tests pass.

### Task 3: Console page and application orchestration

**Files:**
- Create: `console.html`
- Create: `console.css`
- Create: `src/console/app.js`
- Create: `tests/consolePublicPage.test.js`

- [ ] **Step 1: Write failing public-page wiring test**

Assert that `console.html` contains configuration/show mode controls, camera canvas, six slot containers, import/export inputs, status output, and loads `src/console/app.js`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/consolePublicPage.test.js`

Expected: failure because `console.html` does not exist.

- [ ] **Step 3: Build semantic console markup**

Create one application shell with a status header, dominant camera stage, configuration rail, six slot cards rendered by JS, recent event strip, and a reduced show-mode action bar. Include a hidden processing canvas and accessible live regions.

- [ ] **Step 4: Implement the console controller**

Wire camera start/stop, frame processing, color sampling, profile updates, sound upload/preview, entry triggering, reset, configure/show mode switching, master volume, profile import/export, local persistence, wake lock, and fault messages.

The processing loop must call:

```js
const candidates = detectColorPadsFromRgba(frame.data, width, height, {
  colorRules: activeColorRules(profile),
  minArea: profile.recognition.minArea,
  maxPads: 18,
});
const pads = tracker.update(candidates, now);
const entries = entryGate.update(pads);
```

- [ ] **Step 5: Implement the industrial stage-console visual system**

Use CSS variables for charcoal, ivory, amber, and live green; condensed local font stacks; hard ruled cards; large camera typography; trigger pulse animation; responsive setup rail; and full-screen show mode. Provide visible focus, reduced-motion handling, and mobile/tablet fallbacks.

- [ ] **Step 6: Verify public wiring and full tests**

Run: `npm.cmd test`

Expected: all tests pass.

### Task 4: Offline shell and deployment routing

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `netlify.toml`
- Modify: `src/console/app.js`
- Modify: `console.html`

- [ ] **Step 1: Add installable metadata and service worker registration**

Cache `console.html`, `console.css`, the console modules, and reused detection modules. Use cache-first for local assets and network-first navigation with cached console fallback.

- [ ] **Step 2: Add Netlify routes and security headers**

Rewrite `/` to `/console.html`, rewrite `/studio` to `/index.html`, publish the repository root, and add `X-Content-Type-Options`, `Referrer-Policy`, and a camera/microphone Permissions Policy.

- [ ] **Step 3: Run local HTTP smoke checks**

Run the no-cache server, request `/console.html`, `/console.css`, and `/src/console/app.js`, and confirm HTTP 200 responses and expected content types.

- [ ] **Step 4: Run the full automated suite**

Run: `npm.cmd test`

Expected: all tests pass.

### Task 5: Manual browser verification, documentation, and release

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Document operator workflow**

Add concise Chinese and English instructions for first start, remote configuration, color sampling, sound upload, show mode, profile package transfer, recovery, and the legacy `/studio` route.

- [ ] **Step 2: Run final repository checks**

Run: `git diff --check`, `npm.cmd test`, and `git status --short`.

Expected: no whitespace errors, zero test failures, and only intended changes.

- [ ] **Step 3: Start the app and verify it in a real browser**

Verify configuration mode, show mode, responsive layout, camera permission state, sound arming, fallback sound preview, color-sampling interaction, reset, and profile export/import. Inspect browser console output for errors.

- [ ] **Step 4: Commit and push the feature branch**

Commit with an intentional message and push `feature/client-console-v1` to origin.

- [ ] **Step 5: Deploy a Netlify production test site**

Authenticate with Netlify CLI, create or select a dedicated site, deploy the repository root with production routing, and capture the deploy URL.

- [ ] **Step 6: Verify the public URL**

Request the public URL, inspect response headers, load it in a browser, and confirm the root displays Client Show Console rather than the legacy Studio.
