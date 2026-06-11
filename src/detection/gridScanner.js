import { detectColorPadsFromRgba } from "./colorSegmentation.js";

export class GridScanner {
  constructor(options = {}) {
    this.cols = options.cols || 16;
    this.rows = options.rows || 4;
    this.corners = options.corners || {
      tl: { x: 0.2, y: 0.2 },
      tr: { x: 0.8, y: 0.2 },
      br: { x: 0.8, y: 0.8 },
      bl: { x: 0.2, y: 0.8 },
    };
    this.mappingMode = options.mappingMode || "row";
    this.rowInstruments = options.rowInstruments || ["kick", "snare", "hihat", "clap"];
  }

  setOptions(options = {}) {
    if (options.cols !== undefined) this.cols = options.cols;
    if (options.rows !== undefined) this.rows = options.rows;
    if (options.corners !== undefined) this.corners = { ...this.corners, ...options.corners };
    if (options.mappingMode !== undefined) this.mappingMode = options.mappingMode;
    if (options.rowInstruments !== undefined) this.rowInstruments = options.rowInstruments;
  }

  evaluatePoint(u, v) {
    const { tl, tr, br, bl } = this.corners;
    return {
      x:
        (1 - u) * (1 - v) * tl.x +
        u * (1 - v) * tr.x +
        u * v * br.x +
        (1 - u) * v * bl.x,
      y:
        (1 - u) * (1 - v) * tl.y +
        u * (1 - v) * tr.y +
        u * v * br.y +
        (1 - u) * v * bl.y,
    };
  }

  getCellPolygon(col, row) {
    const u0 = col / this.cols;
    const u1 = (col + 1) / this.cols;
    const v0 = row / this.rows;
    const v1 = (row + 1) / this.rows;
    return {
      tl: this.evaluatePoint(u0, v0),
      tr: this.evaluatePoint(u1, v0),
      br: this.evaluatePoint(u1, v1),
      bl: this.evaluatePoint(u0, v1),
    };
  }

  scan(rgba, width, height, colorRules) {
    const validRules = (colorRules || []).filter((rule) => rule && rule.enabled !== false);
    const detectedPads = detectColorPadsFromRgba(rgba, width, height, {
      colorRules: validRules,
      minArea: 24,
      minSaturation: 0.35,
      minValue: 0.16,
      maxPads: 64,
    });
    const gridState = [];

    for (let row = 0; row < this.rows; row += 1) {
      const rowState = [];
      const rowInstrument = this.rowInstruments[row] || "clap";
      for (let col = 0; col < this.cols; col += 1) {
        const cellPoly = this.getCellPolygon(col, row);
        let activePad = null;

        for (const pad of detectedPads) {
          const point = {
            x: pad.centroid.x / width,
            y: pad.centroid.y / height,
          };
          if (this.isPointInPolygon(point, cellPoly) && (!activePad || pad.area > activePad.area)) {
            activePad = pad;
          }
        }

        rowState.push(activePad ? {
          active: true,
          instrument: this.mappingMode === "color" ? activePad.instrument : rowInstrument,
          ruleId: activePad.ruleId,
          ratio: 1,
        } : {
          active: false,
          instrument: this.mappingMode === "row" ? rowInstrument : null,
        });
      }
      gridState.push(rowState);
    }

    return gridState;
  }

  isPointInPolygon(point, poly) {
    const points = [poly.tl, poly.tr, poly.br, poly.bl];
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const intersects = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }
}
