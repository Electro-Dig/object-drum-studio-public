# Changelog

## 0.4.0 - 2026-08-13

### Features

- Expand the client console to ten photo-matched color and sound slots with schema-v1 package migration.
- Add empty-scene Lab background calibration, connected-component foreground detection, robust center sampling, nearest-prototype classification, ambiguity rejection, and three-of-five color voting.
- Keep geometry track IDs stable across one-frame color changes so one object entry cannot retrigger because of color jitter.
- Preserve HSV recognition as an explicit compatibility fallback before calibration.

### Improvements

- Add scene calibration status and a one-click empty-scene capture workflow for remote setup.
- Move the new runtime modules into a fresh service-worker cache generation.
- Prepare this version for a separate Netlify test site without changing the existing client-console deployment.

## 0.3.0 - 2026-07-17

### Features

- Add a standalone Client Show Console with separate remote configuration and client operator modes.
- Trigger overlapping sounds once per object entry across the full camera frame.
- Support six-color mapping and same-color random sound routing.
- Add camera color sampling, six portable sound slots, native Web Audio fallback voices, and uploaded sample persistence.
- Add versioned show-package import/export for moving configuration between computers.
- Add an offline application shell and Netlify routes for the console root and legacy Studio.

### Improvements

- Reuse the tested color segmentation and pad tracking engines without adding more branches to the legacy application controller.
- Add responsive stage-console styling and a reduced show-mode action bar for non-technical operators.
- Add automated coverage for profiles, entry gating, sound routing, package validation, polyphonic audio, page wiring, and deployment configuration.

## 0.2.0 - 2026-06-11

### Features

- Add an AR Step Sequencer mode with a 4-row by 16-step loop grid.
- Add draggable perspective corner handles for aligning the grid with paper, notebooks, or desk layouts.
- Add BPM control, row-based sound mapping, and color-based sound mapping for sequencer playback.
- Add scheduled Tone.js triggering so grid playback stays aligned to the transport.

### Improvements

- Refactor color segmentation to merge physically connected colored pixels before assigning the dominant color by majority vote.
- Add regression tests for split-object color detection and grid scanning.
- Update the public guide and README for the new paper-to-drum-machine workflow.
