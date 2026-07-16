import assert from "node:assert/strict";
import test from "node:test";

import { ConsoleAudioEngine } from "../src/console/audioEngine.js";

test("ConsoleAudioEngine arms once and applies master gain", async () => {
  const context = createFakeAudioContext();
  const engine = new ConsoleAudioEngine({ createContext: () => context });

  await engine.arm();
  engine.setMasterGain(0.4);
  await engine.arm();

  assert.equal(context.resumeCalls, 1);
  assert.equal(context.gains[0].gain.value, 0.4);
});

test("ConsoleAudioEngine creates a fresh sample source for every overlapping trigger", async () => {
  const context = createFakeAudioContext();
  const engine = new ConsoleAudioEngine({ createContext: () => context });
  const slot = { id: "slot-1", gain: 0.8, fallbackVoice: "kick" };

  await engine.arm();
  await engine.loadSample(slot.id, new Uint8Array([1, 2, 3]).buffer);
  const first = engine.trigger(slot, 0.75);
  const second = engine.trigger(slot, 0.75);

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(context.sources.length, 2);
  assert.notEqual(context.sources[0], context.sources[1]);
  assert.ok(context.sources.every((source) => source.started));
  assert.ok(Math.abs(context.gains[1].gain.value - 0.6) < 1e-9);
});

test("ConsoleAudioEngine uses a built-in voice when no uploaded sample exists", async () => {
  const context = createFakeAudioContext();
  const engine = new ConsoleAudioEngine({ createContext: () => context });

  await engine.arm();
  const result = engine.trigger({ id: "slot-6", gain: 1, fallbackVoice: "bell" });

  assert.equal(result, true);
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].started, true);
  assert.equal(context.oscillators[0].stopped, true);
});

function createFakeAudioContext() {
  const context = {
    currentTime: 2,
    destination: {},
    state: "suspended",
    resumeCalls: 0,
    gains: [],
    sources: [],
    oscillators: [],
    async resume() {
      this.state = "running";
      this.resumeCalls += 1;
    },
    createGain() {
      const node = {
        gain: createParam(1),
        connect() { return this; },
      };
      this.gains.push(node);
      return node;
    },
    createBufferSource() {
      const node = {
        buffer: null,
        started: false,
        connect() { return this; },
        start() { this.started = true; },
      };
      this.sources.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        type: "sine",
        frequency: createParam(440),
        started: false,
        stopped: false,
        connect() { return this; },
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      this.oscillators.push(node);
      return node;
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: createParam(1200),
        connect() { return this; },
      };
    },
    async decodeAudioData(buffer) {
      return { decoded: true, byteLength: buffer.byteLength };
    },
  };
  return context;
}

function createParam(value) {
  return {
    value,
    setValueAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime(next) { this.value = next; },
  };
}
