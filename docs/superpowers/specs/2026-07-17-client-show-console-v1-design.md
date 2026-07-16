# Client Show Console V1 Design

**Status:** Approved for autonomous implementation by the project owner on 2026-07-17.

## 1. Outcome

Build a standalone, client-facing event trigger console for the installation scenario. It must let a technical operator configure the experience remotely, then let a client operator run it with only start, pause, reset, and master volume controls.

The new console starts from public `origin/main` commit `49e1d81febee01ff5b486515f23e71c785fa2910`. It reuses the stable color segmentation and pad tracking modules, but it does not reuse the multi-mode `src/app.js` product shell.

## 2. Confirmed Requirements

- Any newly recognized object entering the full camera frame can trigger sound.
- An object triggers once per entry. It can trigger again after it has left and entered again.
- Multiple objects entering together can trigger overlapping sounds.
- Default mapping is six colors to six sounds.
- An optional same-color random mode uses one recognized color and randomly chooses among enabled sound slots.
- The full camera image is the recognition region. Camera position is adjusted physically.
- Camera, computer, and venue can all change between uses.
- Technical configuration happens through remote communication; client staff run the show locally.
- The venue normally has network access, but brief outages are acceptable.
- Background music is outside this application.

## 3. Product Direction

### Option A: add another mode to Object Drum Studio

This is the lowest-effort path, but it keeps setup controls, experimental modes, and performance controls in one large controller. It makes remote instructions harder and increases the chance of accidental changes during an event.

### Option B: standalone console in the same repository — selected

Create a separate `console.html` entry point, independent app controller, and focused modules under `src/console/`. Reuse only stable vision primitives from the original project. This keeps the work close to proven code while giving the client a purpose-built workflow.

### Option C: completely new repository and recognition engine

This offers maximum isolation but discards tested segmentation and tracking behavior. It adds risk without improving the first client release.

## 4. Users and Modes

### Configure mode

Used by the technical operator, often over remote screen sharing. It provides:

1. system check for browser, camera, audio, and saved profile;
2. live camera preview and six color calibration slots;
3. six sound slots with upload, preview, volume, and enable controls;
4. mapping selection between `six-color` and `same-color-random`;
5. a test monitor showing recognized objects and recent triggers;
6. show-package import/export for moving configuration between computers;
7. a single “enter show mode” action.

### Show mode

Used by client staff. It provides:

- a large live stage view;
- one unmistakable state: ready, live, paused, or fault;
- Start/Pause, Reset, master volume, and “return to configuration” controls;
- recent trigger feedback without exposing thresholds or mappings;
- automatic recovery hints when the camera or audio is unavailable.

## 5. Visual Direction

The console uses an industrial stage-instrument aesthetic: charcoal and warm black surfaces, ivory text, amber readiness accents, and acid-green live status. Condensed typography, ruled borders, and physical-console labels make it read as equipment rather than a generic dashboard.

The camera is the dominant surface. Setup controls occupy a structured side rail; show mode removes the side rail and turns the status into a large top banner. Motion is restrained to state changes and trigger pulses so it remains legible under event pressure.

## 6. Architecture

```text
console.html
  -> src/console/app.js                 browser orchestration and DOM events
       -> profile.js                   normalized six-slot show configuration
       -> entryGate.js                 once-per-entry state machine
       -> soundSelector.js             color mapping and random routing
       -> sampleStore.js               IndexedDB sample persistence
       -> audioEngine.js               native Web Audio polyphonic playback
       -> ../detection/colorSegmentation.js
       -> ../detection/padTracker.js
```

`src/app.js` remains untouched and continues to serve the experimental studio at `index.html`. Netlify rewrites the deployment root to `console.html`; `/studio` remains available for the original interface.

## 7. Recognition and Trigger Flow

1. Draw the camera frame into a low-resolution processing canvas.
2. Build active color rules from the normalized profile.
3. Run `detectColorPadsFromRgba` over the full frame.
4. Pass candidates through `PadTracker` with two-frame confirmation and a short missing-object TTL.
5. Pass confirmed pads into `EntryGate`.
6. For each newly active track, select a sound slot using the current mapping mode.
7. Start a new Web Audio source for every event; do not stop prior sources.
8. Draw recognition outlines and append an event to the short trigger log.

The gate resets whenever the camera restarts, the operator presses reset, or mapping rules change. This prevents stale track IDs from leaking across configurations.

## 8. Audio

The new audio engine uses the browser's native `AudioContext`, removing the runtime dependency on the remotely hosted Tone module.

- Uploaded audio is decoded once and cached per slot.
- Each trigger creates a fresh `AudioBufferSourceNode`, allowing overlap.
- Slot gain and master gain are separate.
- Six built-in synthesized fallback voices make a new profile immediately testable without uploads.
- Audio context activation happens only from an explicit operator click to comply with browser autoplay rules.

## 9. Profiles and Portability

Profile metadata is stored in `localStorage`; uploaded audio data is stored in IndexedDB. A show package is a versioned JSON file containing profile settings and optional audio data URLs. Import validates and normalizes the package before replacing local configuration.

The profile stores only portable values:

- schema version and profile name;
- mapping mode;
- six color rules and labels;
- six sound slot labels, gains, enabled state, and file names;
- recognition sensitivity and master volume.

Camera device IDs are intentionally not portable because browser permissions and hardware change between venues.

## 10. Failure Handling

- Camera denied or missing: show a fault state and a retry action.
- Audio not armed: show a dedicated “enable sound” action.
- No configured colors: prevent show mode and link back to calibration.
- Missing uploaded sample: use the built-in fallback voice and label it clearly.
- Invalid show package: keep the current profile and report the validation error.
- Brief network loss: the active session continues because recognition and audio are local. A service worker caches the console assets after first load for reload resilience.

## 11. Accessibility and Operational Safety

- All primary actions are keyboard reachable and have visible focus states.
- Status does not rely on color alone; text and icons accompany state.
- Destructive reset-to-default requires confirmation; runtime reset does not.
- Show mode hides calibration inputs and file controls.
- A wake lock is requested while live when the browser supports it.

## 12. Verification

Automated tests cover profile normalization, rule generation, once-per-entry gating, simultaneous entries, sound routing, package validation, and public page wiring. Existing project tests must remain green.

Manual browser verification covers camera permission, color sampling, sample upload and overlap, mode switching, show-package round trip, responsive layout, offline reload after first load, and deployment headers.

## 13. First-Release Boundary

V1 does not include cloud accounts, remote control over the internet, background music, server-side storage, automatic camera positioning, or machine-learning object classification. Remote assistance continues through the client's existing screen-sharing or communication tool.
