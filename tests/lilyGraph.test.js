import assert from "node:assert/strict";
import test from "node:test";

import { buildLilyGraph } from "../src/lily/lilyGraph.js";

test("buildLilyGraph connects nodes within range and sorts neighbors by distance", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0 },
    { id: "B", x: 50, y: 0 },
    { id: "C", x: 130, y: 0 },
    { id: "D", x: 60, y: 0 },
  ], { range: 80 });

  const edgeKeys = graph.edges.map((edge) => `${edge.from}-${edge.to}`);
  assert.ok(edgeKeys.includes("A-B"));
  assert.ok(edgeKeys.includes("B-C"));
  assert.ok(!edgeKeys.includes("A-C"));
  assert.equal(graph.neighborsById.A[0].id, "B");
  assert.equal(graph.neighborsById.A[1].id, "D");
});

test("buildLilyGraph returns empty neighbor arrays for isolated nodes", () => {
  const graph = buildLilyGraph([
    { id: "A", x: 0, y: 0 },
    { id: "B", x: 200, y: 0 },
  ], { range: 40 });

  assert.deepEqual(graph.edges, []);
  assert.deepEqual(graph.neighborsById.A, []);
  assert.deepEqual(graph.neighborsById.B, []);
});
