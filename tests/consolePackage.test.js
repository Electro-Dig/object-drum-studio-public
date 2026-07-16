import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultProfile } from "../src/console/profile.js";
import {
  buildShowPackage,
  readShowPackage,
} from "../src/console/sampleStore.js";

test("buildShowPackage creates a portable versioned package with valid audio records", () => {
  const profile = createDefaultProfile();
  profile.name = "华西现场";
  const packageValue = buildShowPackage(profile, {
    "slot-1": {
      name: "impact.wav",
      type: "audio/wav",
      dataUrl: "data:audio/wav;base64,AA==",
    },
    unknown: {
      name: "ignore.wav",
      type: "audio/wav",
      dataUrl: "data:audio/wav;base64,AA==",
    },
  });

  assert.equal(packageValue.schemaVersion, 1);
  assert.equal(packageValue.profile.name, "华西现场");
  assert.equal(packageValue.samples["slot-1"].name, "impact.wav");
  assert.equal(packageValue.samples.unknown, undefined);
});

test("readShowPackage parses and normalizes a JSON package", () => {
  const text = JSON.stringify(buildShowPackage(createDefaultProfile(), {
    "slot-2": {
      name: "glass.mp3",
      type: "audio/mpeg",
      dataUrl: "data:audio/mpeg;base64,AA==",
    },
  }));

  const result = readShowPackage(text);

  assert.equal(result.profile.slots.length, 6);
  assert.equal(result.samples["slot-2"].type, "audio/mpeg");
});

test("readShowPackage reports invalid JSON and unsupported schemas", () => {
  assert.throws(() => readShowPackage("not-json"), /无法读取配置包/);
  assert.throws(
    () => readShowPackage(JSON.stringify({ schemaVersion: 7, profile: {} })),
    /不支持的配置包版本/,
  );
});
