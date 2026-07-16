# Changelog

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
