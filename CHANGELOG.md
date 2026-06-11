# Changelog

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
