import { classifyColor, colorDistance, rgbToLab } from "./colorMetrics.js";
import { rgbToHsv } from "./colorSegmentation.js";

const DEFAULT_OPTIONS = Object.freeze({
  foregroundDeltaE: 12,
  maxForegroundFraction: 0.62,
  maxColorDistance: 36,
  minColorMargin: 3,
  minArea: 72,
  maxObjects: 24,
  innerShrink: 0.18,
  morphology: true,
});

export function createBackgroundModel(rgba, width, height) {
  validateFrame(rgba, width, height);
  const pixelCount = width * height;
  const lab = new Float32Array(pixelCount * 3);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const rgbaIndex = pixelIndex * 4;
    const color = rgbToLab(rgba[rgbaIndex], rgba[rgbaIndex + 1], rgba[rgbaIndex + 2]);
    const labIndex = pixelIndex * 3;
    lab[labIndex] = color.l;
    lab[labIndex + 1] = color.a;
    lab[labIndex + 2] = color.b;
  }
  return { width, height, lab };
}

export function detectCalibratedObjects(rgba, width, height, options = {}) {
  validateFrame(rgba, width, height);
  const opts = { ...DEFAULT_OPTIONS, ...options };
  validateBackgroundModel(opts.backgroundModel, width, height);
  const roi = normalizeRoi(opts.roi, width, height);
  const excludeRects = normalizeRects(opts.excludeRects, width, height);
  const pixelCount = width * height;
  const currentLab = new Float32Array(pixelCount * 3);
  let mask = new Uint8Array(pixelCount);
  let foregroundCount = 0;
  let consideredCount = 0;

  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      if (pointInAnyRect(x, y, excludeRects)) continue;
      const pixelIndex = y * width + x;
      const rgbaIndex = pixelIndex * 4;
      if (rgba[rgbaIndex + 3] < 32) continue;
      consideredCount += 1;
      const lab = rgbToLab(rgba[rgbaIndex], rgba[rgbaIndex + 1], rgba[rgbaIndex + 2]);
      const labIndex = pixelIndex * 3;
      currentLab[labIndex] = lab.l;
      currentLab[labIndex + 1] = lab.a;
      currentLab[labIndex + 2] = lab.b;
      const backgroundLab = readLab(opts.backgroundModel.lab, labIndex);
      if (colorDistance(lab, backgroundLab) >= opts.foregroundDeltaE) {
        mask[pixelIndex] = 1;
        foregroundCount += 1;
      }
    }
  }

  const foregroundFraction = consideredCount > 0 ? foregroundCount / consideredCount : 0;
  if (foregroundFraction > opts.maxForegroundFraction) {
    return { status: "background-mismatch", pads: [], foregroundFraction };
  }
  if (opts.morphology && foregroundCount > 0) {
    mask = closeMask(openMask(mask, width, height), width, height);
  }

  const foregroundComponents = connectedComponents(mask, width, height, roi);
  const components = foregroundComponents.flatMap((component) => (
    splitComponentByPrototype(component, currentLab, width, height, opts)
  ));
  const pads = [];
  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const component = components[componentIndex];
    if (component.indices.length < opts.minArea) continue;
    const sample = sampleComponent(component, rgba, currentLab, width, opts.innerShrink);
    const classification = classifyColor(sample.lab, opts.prototypes, {
      maxDistance: opts.maxColorDistance,
      minMargin: opts.minColorMargin,
    });
    if (!classification) continue;
    const bounds = {
      x: component.minX,
      y: component.minY,
      width: component.maxX - component.minX + 1,
      height: component.maxY - component.minY + 1,
    };
    const hsv = rgbToHsv(sample.rgb.r, sample.rgb.g, sample.rgb.b);
    pads.push({
      id: `calibrated-${componentIndex + 1}`,
      instrument: classification.instrument,
      ruleId: classification.ruleId ?? classification.id ?? null,
      label: classification.label ?? classification.ruleId ?? "OBJECT",
      hue: hsv.h,
      area: component.indices.length,
      bounds,
      centroid: {
        x: component.sumX / component.indices.length,
        y: component.sumY / component.indices.length,
      },
      color: sample.rgb,
      outline: boundsToOutline(bounds),
      classification: {
        distance: classification.distance,
        margin: classification.margin,
        confidence: classification.confidence,
        lab: sample.lab,
      },
    });
  }

  pads.sort((first, second) => second.area - first.area);
  return {
    status: "ok",
    pads: pads.slice(0, Math.max(1, Math.round(opts.maxObjects))),
    foregroundFraction,
  };
}

function connectedComponents(mask, width, height, roi) {
  const visited = new Uint8Array(mask.length);
  const components = [];
  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;
      const stack = [start];
      const component = {
        indices: [],
        minX: x,
        minY: y,
        maxX: x,
        maxY: y,
        sumX: 0,
        sumY: 0,
      };
      visited[start] = 1;
      while (stack.length) {
        const pixelIndex = stack.pop();
        const px = pixelIndex % width;
        const py = Math.floor(pixelIndex / width);
        component.indices.push(pixelIndex);
        component.minX = Math.min(component.minX, px);
        component.minY = Math.min(component.minY, py);
        component.maxX = Math.max(component.maxX, px);
        component.maxY = Math.max(component.maxY, py);
        component.sumX += px;
        component.sumY += py;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const neighbor = ny * width + nx;
            if (!mask[neighbor] || visited[neighbor]) continue;
            visited[neighbor] = 1;
            stack.push(neighbor);
          }
        }
      }
      components.push(component);
    }
  }
  return components;
}

function splitComponentByPrototype(component, currentLab, width, height, options) {
  if (!Array.isArray(options.prototypes) || options.prototypes.length === 0) return [component];
  const groups = new Map();
  for (const pixelIndex of component.indices) {
    const classification = classifyColor(readLab(currentLab, pixelIndex * 3), options.prototypes, {
      maxDistance: options.maxColorDistance,
      minMargin: options.minColorMargin,
    });
    if (!classification) continue;
    const key = classification.ruleId ?? classification.id ?? classification.instrument;
    if (!key) continue;
    const indices = groups.get(key) ?? [];
    indices.push(pixelIndex);
    groups.set(key, indices);
  }

  const components = [];
  for (const indices of groups.values()) {
    for (const subcomponent of connectedIndexComponents(indices, width, height)) {
      if (hasPaintedCenter(subcomponent, width)) components.push(subcomponent);
    }
  }
  return components;
}

function connectedIndexComponents(indices, width, height) {
  const remaining = new Set(indices);
  const components = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    remaining.delete(start);
    const stack = [start];
    const component = {
      indices: [],
      minX: start % width,
      minY: Math.floor(start / width),
      maxX: start % width,
      maxY: Math.floor(start / width),
      sumX: 0,
      sumY: 0,
    };
    while (stack.length) {
      const pixelIndex = stack.pop();
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      component.indices.push(pixelIndex);
      component.minX = Math.min(component.minX, x);
      component.minY = Math.min(component.minY, y);
      component.maxX = Math.max(component.maxX, x);
      component.maxY = Math.max(component.maxY, y);
      component.sumX += x;
      component.sumY += y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (!remaining.has(neighbor)) continue;
          remaining.delete(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function hasPaintedCenter(component, width) {
  const componentWidth = component.maxX - component.minX + 1;
  const componentHeight = component.maxY - component.minY + 1;
  if (componentWidth < 5 || componentHeight < 5) return true;
  const insetX = componentWidth / 3;
  const insetY = componentHeight / 3;
  const left = component.minX + insetX;
  const right = component.maxX - insetX;
  const top = component.minY + insetY;
  const bottom = component.maxY - insetY;
  return component.indices.some((pixelIndex) => {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    return x >= left && x <= right && y >= top && y <= bottom;
  });
}

function sampleComponent(component, rgba, currentLab, width, innerShrink) {
  const componentWidth = component.maxX - component.minX + 1;
  const componentHeight = component.maxY - component.minY + 1;
  const padding = Math.max(0, Math.floor(Math.min(componentWidth, componentHeight) * innerShrink));
  const interior = component.indices.filter((pixelIndex) => {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    return x >= component.minX + padding
      && x <= component.maxX - padding
      && y >= component.minY + padding
      && y <= component.maxY - padding;
  });
  const candidates = interior.length >= 4 ? interior : component.indices;
  const stride = Math.max(1, Math.ceil(candidates.length / 512));
  const channels = { l: [], a: [], b: [], r: [], g: [], blue: [] };
  for (let index = 0; index < candidates.length; index += stride) {
    const pixelIndex = candidates[index];
    const labIndex = pixelIndex * 3;
    const rgbaIndex = pixelIndex * 4;
    channels.l.push(currentLab[labIndex]);
    channels.a.push(currentLab[labIndex + 1]);
    channels.b.push(currentLab[labIndex + 2]);
    channels.r.push(rgba[rgbaIndex]);
    channels.g.push(rgba[rgbaIndex + 1]);
    channels.blue.push(rgba[rgbaIndex + 2]);
  }
  return {
    lab: {
      l: median(channels.l),
      a: median(channels.a),
      b: median(channels.b),
    },
    rgb: {
      r: Math.round(median(channels.r)),
      g: Math.round(median(channels.g)),
      b: Math.round(median(channels.blue)),
    },
  };
}

function openMask(mask, width, height) {
  return dilate(erode(mask, width, height), width, height);
}

function closeMask(mask, width, height) {
  return erode(dilate(mask, width, height), width, height);
}

function erode(mask, width, height) {
  const result = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let keep = 1;
      for (let dy = -1; dy <= 1 && keep; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!mask[(y + dy) * width + x + dx]) {
            keep = 0;
            break;
          }
        }
      }
      result[y * width + x] = keep;
    }
  }
  return result;
}

function dilate(mask, width, height) {
  const result = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let fill = 0;
      for (let dy = -1; dy <= 1 && !fill; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (mask[(y + dy) * width + x + dx]) {
            fill = 1;
            break;
          }
        }
      }
      result[y * width + x] = fill;
    }
  }
  return result;
}

function normalizeRoi(value, width, height) {
  if (!value) return { x: 0, y: 0, width, height };
  const x = clamp(Math.floor(Number(value.x) || 0), 0, width - 1);
  const y = clamp(Math.floor(Number(value.y) || 0), 0, height - 1);
  const roiWidth = clamp(Math.ceil(Number(value.width) || width), 1, width - x);
  const roiHeight = clamp(Math.ceil(Number(value.height) || height), 1, height - y);
  return { x, y, width: roiWidth, height: roiHeight };
}

function normalizeRects(values, width, height) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => normalizeRoi(value, width, height));
}

function pointInAnyRect(x, y, rects) {
  return rects.some((rect) => x >= rect.x
    && y >= rect.y
    && x < rect.x + rect.width
    && y < rect.y + rect.height);
}

function validateFrame(rgba, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new TypeError("画面尺寸无效");
  }
  if (!rgba || rgba.length < width * height * 4) throw new TypeError("画面像素数据无效");
}

function validateBackgroundModel(model, width, height) {
  if (!model || model.width !== width || model.height !== height || model.lab?.length !== width * height * 3) {
    throw new TypeError("空场背景与当前画面尺寸不一致");
  }
}

function readLab(buffer, index) {
  return { l: buffer[index], a: buffer[index + 1], b: buffer[index + 2] };
}

function boundsToOutline(bounds) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return [
    { x: bounds.x, y: bounds.y },
    { x: right, y: bounds.y },
    { x: right, y: bottom },
    { x: bounds.x, y: bottom },
  ];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
