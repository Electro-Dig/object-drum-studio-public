import assert from "node:assert/strict";
import test from "node:test";

import { buildLilyGraph } from "../src/lily/lilyGraph.js";
import { createLilyPulseEvents } from "../src/lily/lilyPropagation.js";

test("createLilyPulseEvents propagates once per node when feedback is disabled", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0, scaleStep: 0, octave: 3 },
    { id: "B", x: 50, y: 0, scaleStep: 1, octave: 3 },
    { id: "C", x: 100, y: 0, scaleStep: 2, octave: 3 },
  ], { range: 55 });

  const events = createLilyPulseEvents(graph, "A", {
    allowFeedback: false,
    spreadMs: 120,
    maxTriggers: 10,
  });

  assert.deepEqual(events.map((event) => event.nodeId), ["A", "B", "C"]);
  assert.deepEqual(events.map((event) => event.delayMs), [0, 120, 240]);
});

test("createLilyPulseEvents caps feedback-enabled cyclic propagation", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0, scaleStep: 0, octave: 3 },
    { id: "B", x: 40, y: 0, scaleStep: 1, octave: 3 },
  ], { range: 50 });

  const events = createLilyPulseEvents(graph, "A", {
    allowFeedback: true,
    spreadMs: 80,
    maxTriggers: 5,
  });

  assert.equal(events.length, 5);
  assert.deepEqual(events.map((event) => event.nodeId), ["A", "B", "A", "B", "A"]);
  assert.equal(events[4].delayMs, 320);
});

test("createLilyPulseEvents uses voice roles by graph depth", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0 },
    { id: "B", x: 40, y: 0 },
    { id: "C", x: 80, y: 0 },
  ], { range: 45 });

  const events = createLilyPulseEvents(graph, "A", { spreadMs: 100 });

  assert.equal(events[0].voiceRole, "sourcePulse");
  assert.equal(events[1].voiceRole, "pluck");
  assert.equal(events[2].voiceRole, "bell");
});

test("createLilyPulseEvents preserves explicit node voice ids for color ensemble mode", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0, voiceId: "warm-marimba" },
    { id: "B", x: 40, y: 0, voiceId: "soft-kalimba" },
  ], { range: 45 });

  const events = createLilyPulseEvents(graph, "A", {
    mappingMode: "color-ensemble",
    spreadMs: 100,
  });

  assert.equal(events[0].voiceId, "warm-marimba");
  assert.equal(events[1].voiceId, "soft-kalimba");
});

test("createLilyPulseEvents keeps melody-instrument events on one instrument id", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0 },
    { id: "B", x: 40, y: 0 },
  ], { range: 45 });

  const events = createLilyPulseEvents(graph, "A", {
    mappingMode: "melody-instrument",
    instrumentId: "gemidi-marimba",
  });

  assert.deepEqual(events.map((event) => event.instrumentId), ["gemidi-marimba", "gemidi-marimba"]);
});
