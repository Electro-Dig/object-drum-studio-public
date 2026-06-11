import assert from "node:assert/strict";
import test from "node:test";

import { GridScanner } from "../src/detection/gridScanner.js";

test("GridScanner bilinear interpolation maps grid coordinates into camera space", () => {
  const scanner = new GridScanner({
    corners: {
      tl: { x: 0, y: 0 },
      tr: { x: 100, y: 0 },
      br: { x: 100, y: 100 },
      bl: { x: 0, y: 100 },
    },
  });

  assert.deepEqual(scanner.evaluatePoint(0.5, 0.5), { x: 50, y: 50 });
  assert.deepEqual(scanner.evaluatePoint(1, 0), { x: 100, y: 0 });
});

test("GridScanner detects whether a point is inside a cell polygon", () => {
  const scanner = new GridScanner();
  const poly = {
    tl: { x: 0, y: 0 },
    tr: { x: 1, y: 0 },
    br: { x: 1, y: 1 },
    bl: { x: 0, y: 1 },
  };

  assert.equal(scanner.isPointInPolygon({ x: 0.5, y: 0.5 }, poly), true);
  assert.equal(scanner.isPointInPolygon({ x: 1.5, y: 0.5 }, poly), false);
});

test("GridScanner scan activates the cell containing a detected object centroid", () => {
  const scanner = new GridScanner({
    cols: 4,
    rows: 4,
    corners: {
      tl: { x: 0, y: 0 },
      tr: { x: 1, y: 0 },
      br: { x: 1, y: 1 },
      bl: { x: 0, y: 1 },
    },
    mappingMode: "row",
    rowInstruments: ["kick", "snare", "hihat", "clap"],
  });

  const width = 40;
  const height = 40;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const index = (y * width + x) * 4;
      rgba[index] = 255;
      rgba[index + 1] = 0;
      rgba[index + 2] = 0;
      rgba[index + 3] = 255;
    }
  }

  const result = scanner.scan(rgba, width, height, [{
    id: "kick-red",
    instrument: "kick",
    enabled: true,
    hueCenter: 356,
    hueRange: 18,
    minSaturation: 0.5,
    minValue: 0.22,
    maxValue: 1,
  }]);

  assert.equal(result[0][0].active, true);
  assert.equal(result[0][0].instrument, "kick");
  assert.equal(result[0][1].active, false);
});
