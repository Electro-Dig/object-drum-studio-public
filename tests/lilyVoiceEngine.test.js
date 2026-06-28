import assert from "node:assert/strict";
import test from "node:test";

import { LilyVoiceEngine } from "../src/lily/lilyVoiceEngine.js";

test("LilyVoiceEngine builds pluck voices without wrapping PluckSynth in PolySynth", async () => {
  const Tone = createFakeTone();
  const engine = new LilyVoiceEngine({ Tone });

  engine.setPalette({
    effects: {},
    voices: {
      pluck: {
        synth: "pluck",
        gain: 0.6,
        duration: 0.2,
      },
    },
  });

  await engine.start();

  assert.equal(engine.voices.get("pluck").synth.constructor.name, "PluckSynth");
});

function createFakeTone() {
  class AudioNode {
    connect() {
      return this;
    }

    dispose() {}
  }

  class Param {
    constructor(value = 0) {
      this.value = value;
    }

    setValueAtTime(value) {
      this.value = value;
    }
  }

  class Monophonic extends AudioNode {
    set(options) {
      this.options = options;
    }

    triggerAttackRelease() {}
  }

  class Synth extends Monophonic {}
  class FMSynth extends Monophonic {}
  class MonoSynth extends Monophonic {}

  class PluckSynth extends AudioNode {
    set(options) {
      this.options = options;
    }

    triggerAttackRelease() {}
  }

  class PolySynth extends AudioNode {
    constructor(Voice) {
      super();
      if (!(Voice.prototype instanceof Monophonic)) {
        throw new Error("Voice must extend Monophonic class");
      }
      this.Voice = Voice;
    }

    set(options) {
      this.options = options;
    }

    triggerAttackRelease() {}
  }

  class Filter extends AudioNode {
    constructor(frequency) {
      super();
      this.frequency = new Param(frequency);
    }
  }

  class Gain extends AudioNode {
    constructor(value) {
      super();
      this.gain = new Param(value);
    }
  }

  class Limiter extends AudioNode {
    toDestination() {
      return this;
    }
  }

  return {
    start: async () => {},
    now: () => 0,
    Synth,
    FMSynth,
    MonoSynth,
    PluckSynth,
    PolySynth,
    Filter,
    Gain,
    Limiter,
  };
}
