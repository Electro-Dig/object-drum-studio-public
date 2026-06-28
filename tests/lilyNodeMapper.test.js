import assert from "node:assert/strict";
import test from "node:test";

import {
  createFixedSourceNode,
  createLilyNodesFromPads,
  pickLilyNodeAtPoint,
} from "../src/lily/lilyNodeMapper.js";

test("createLilyNodesFromPads maps tracked pads into playable lily nodes", () => {
  const nodes = createLilyNodesFromPads([
    {
      id: "tracked-1",
      hue: 120,
      area: 80,
      centroid: { x: 40, y: 20 },
      bounds: { x: 30, y: 10, width: 20, height: 20 },
      color: { r: 65, g: 207, b: 174 },
      label: "Green cup",
      ruleId: "hihat-green",
    },
  ], { width: 100, height: 100 }, { sourceId: "tracked-1" });

  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].id, "tracked-1");
  assert.equal(nodes[0].x, 40);
  assert.equal(nodes[0].y, 20);
  assert.equal(nodes[0].scaleStep, 1);
  assert.equal(nodes[0].octave, 4);
  assert.equal(nodes[0].isSource, true);
  assert.equal(nodes[0].note, "D4");
  assert.deepEqual(nodes[0].color, { r: 65, g: 207, b: 174 });
});

test("createLilyNodesFromPads keeps visual radii in a narrow playable range", () => {
  const nodes = createLilyNodesFromPads([
    {
      id: "small-blue",
      hue: 185,
      area: 64,
      centroid: { x: 20, y: 20 },
      bounds: { x: 12, y: 12, width: 10, height: 10 },
      color: { r: 80, g: 190, b: 220 },
      ruleId: "pad-cyan",
    },
    {
      id: "large-orange",
      hue: 30,
      area: 2500,
      centroid: { x: 70, y: 20 },
      bounds: { x: 48, y: 0, width: 54, height: 54 },
      color: { r: 236, g: 130, b: 40 },
      ruleId: "kick-red",
    },
  ], { width: 120, height: 80 }, {
    maxAreaRatio: 1,
    maxBoundsRatio: 1,
  });

  const radii = nodes.map((node) => node.radius).sort((a, b) => a - b);
  assert.ok(radii[0] >= 12);
  assert.ok(radii[1] <= 18);
  assert.ok(radii[1] - radii[0] <= 6);
});

test("pickLilyNodeAtPoint returns the nearest node inside the hit radius", () => {
  const nodes = [
    { id: "a", x: 10, y: 10 },
    { id: "b", x: 40, y: 20 },
  ];

  assert.equal(pickLilyNodeAtPoint(nodes, { x: 43, y: 22 }, 20).id, "b");
  assert.equal(pickLilyNodeAtPoint(nodes, { x: 90, y: 90 }, 20), null);
});

test("createFixedSourceNode places a virtual source in the frame center", () => {
  const node = createFixedSourceNode({ width: 120, height: 80 });

  assert.equal(node.id, "fixed-source");
  assert.equal(node.x, 60);
  assert.equal(node.y, 40);
  assert.equal(node.isSource, true);
  assert.equal(node.isFixedSource, true);
});

test("melody-instrument mapping assigns notes by spatial rank instead of hue", () => {
  const nodes = createLilyNodesFromPads([
    {
      id: "right-yellow",
      hue: 45,
      area: 100,
      centroid: { x: 80, y: 55 },
      bounds: { x: 72, y: 47, width: 16, height: 16 },
      color: { r: 240, g: 200, b: 70 },
      ruleId: "yellow-bead",
    },
    {
      id: "left-orange",
      hue: 45,
      area: 100,
      centroid: { x: 20, y: 55 },
      bounds: { x: 12, y: 47, width: 16, height: 16 },
      color: { r: 236, g: 130, b: 40 },
      ruleId: "orange-bead",
    },
  ], { width: 100, height: 100 }, {
    mappingMode: "melody-instrument",
    scaleId: "major-pentatonic",
    minOctave: 3,
    maxOctave: 4,
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  assert.equal(byId.get("left-orange").scaleStep, 0);
  assert.equal(byId.get("left-orange").note, "C3");
  assert.equal(byId.get("right-yellow").scaleStep, 1);
  assert.equal(byId.get("right-yellow").note, "D3");
});

test("color-ensemble mapping assigns voice ids from rule identity", () => {
  const nodes = createLilyNodesFromPads([
    {
      id: "orange",
      hue: 30,
      area: 100,
      centroid: { x: 20, y: 55 },
      bounds: { x: 12, y: 47, width: 16, height: 16 },
      color: { r: 236, g: 130, b: 40 },
      ruleId: "kick-red",
    },
    {
      id: "green",
      hue: 125,
      area: 100,
      centroid: { x: 60, y: 55 },
      bounds: { x: 52, y: 47, width: 16, height: 16 },
      color: { r: 65, g: 207, b: 174 },
      ruleId: "hihat-green",
    },
  ], { width: 100, height: 100 }, {
    mappingMode: "color-ensemble",
    scaleId: "major-pentatonic",
  });

  assert.equal(nodes.find((node) => node.id === "orange").voiceId, "gemidi-marimba");
  assert.equal(nodes.find((node) => node.id === "green").voiceId, "soft-kalimba");
});

test("color-ensemble mapping can use explicit global preset assignments", () => {
  const nodes = createLilyNodesFromPads([
    {
      id: "orange",
      hue: 30,
      area: 100,
      centroid: { x: 20, y: 55 },
      bounds: { x: 12, y: 47, width: 16, height: 16 },
      color: { r: 236, g: 130, b: 40 },
      ruleId: "orange-rule",
      instrument: "kick",
    },
    {
      id: "green",
      hue: 125,
      area: 100,
      centroid: { x: 60, y: 55 },
      bounds: { x: 52, y: 47, width: 16, height: 16 },
      color: { r: 65, g: 207, b: 174 },
      ruleId: "green-rule",
      instrument: "hihat",
    },
  ], { width: 100, height: 100 }, {
    mappingMode: "color-ensemble",
    scaleId: "major-pentatonic",
    ensembleAssignments: {
      "orange-rule": "bass-pulse",
      "green-rule": "glass-bell",
    },
  });

  assert.equal(nodes.find((node) => node.id === "orange").voiceId, "bass-pulse");
  assert.equal(nodes.find((node) => node.id === "green").voiceId, "glass-bell");
});

test("color-ensemble mapping can keep dynamic library preset assignments", () => {
  const nodes = createLilyNodesFromPads([
    {
      id: "orange",
      hue: 30,
      area: 100,
      centroid: { x: 20, y: 55 },
      bounds: { x: 12, y: 47, width: 16, height: 16 },
      color: { r: 236, g: 130, b: 40 },
      ruleId: "orange-rule",
      instrument: "kick",
    },
  ], { width: 100, height: 100 }, {
    mappingMode: "color-ensemble",
    scaleId: "major-pentatonic",
    allowedPresetIds: new Set(["library:preset-soft-pluck"]),
    ensembleAssignments: {
      "orange-rule": "library:preset-soft-pluck",
    },
  });

  assert.equal(nodes.find((node) => node.id === "orange").voiceId, "library:preset-soft-pluck");
});
