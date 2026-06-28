import { scaleStepToNote } from "./lilyScales.js";
import { getLilyPalette } from "./lilyPalettes.js";
import { nextStrictStartTime } from "../audio/triggerScheduler.js";

export class LilyVoiceEngine {
  constructor({ Tone }) {
    if (!Tone) throw new Error("LilyVoiceEngine requires a Tone instance.");
    this.Tone = Tone;
    this.ready = false;
    this.palette = getLilyPalette();
    this.output = null;
    this.limiter = null;
    this.reverb = null;
    this.voices = new Map();
    this.lastStartTimeByRole = new Map();
  }

  async start() {
    if (this.ready) return;
    await this.Tone.start();
    this.buildOutput();
    this.buildVoices();
    this.ready = true;
  }

  setPalette(palette) {
    this.palette = palette || getLilyPalette();
    if (this.ready) {
      this.buildOutput();
      this.buildVoices();
    }
  }

  trigger(event = {}, options = {}) {
    if (!this.ready) return false;
    const role = roleFor(event.voiceRole);
    const voiceId = event.voiceId ? String(event.voiceId) : "";
    const voice = this.voices.get(role) || this.voices.get("pluck");
    const selectedVoice = this.voices.get(voiceId) || voice;
    if (!selectedVoice?.synth) return false;

    const note = event.note || scaleStepToNote(
      options.scaleId || "major-pentatonic",
      event.scaleStep || 0,
      event.octave || 3,
      options.root || "C",
    );
    const velocity = clamp(numberOr(event.velocity, 0.7), 0.08, 0.95);
    const duration = clamp(numberOr(event.duration, selectedVoice.duration), 0.04, 2.8);
    const requestedTime = Number.isFinite(Number(event.time))
      ? Number(event.time)
      : this.Tone.now() + Math.max(0, numberOr(event.delayMs, 0)) / 1000;
    const startKey = voiceId || role;
    const time = nextStrictStartTime(this.lastStartTimeByRole, startKey, requestedTime, this.Tone.now(), 0.008);

    try {
      selectedVoice.gain.gain.setValueAtTime(clamp(numberOr(selectedVoice.gainValue, 0.6) * velocity, 0.001, 1.2), time);
      if (selectedVoice.filter && Number.isFinite(Number(selectedVoice.cutoff))) {
        selectedVoice.filter.frequency.setValueAtTime(Number(selectedVoice.cutoff), time);
      }
      selectedVoice.synth.triggerAttackRelease(note, duration, time, velocity);
      return true;
    } catch (error) {
      console.warn("[LilyVoiceEngine] trigger failed:", error);
      return false;
    }
  }

  dispose() {
    for (const voice of this.voices.values()) disposeVoice(voice);
    this.voices.clear();
    disposeAudioNode(this.reverb);
    disposeAudioNode(this.limiter);
    this.reverb = null;
    this.limiter = null;
    this.output = null;
    this.ready = false;
  }

  buildOutput() {
    disposeAudioNode(this.reverb);
    disposeAudioNode(this.limiter);
    const effects = this.palette.effects || {};
    const limiterDb = clamp(numberOr(effects.limiterDb, -2), -18, 0);
    this.limiter = new this.Tone.Limiter(limiterDb).toDestination();
    const reverbWet = clamp(numberOr(effects.reverbWet, 0), 0, 0.9);

    if (reverbWet > 0 && this.Tone.Reverb) {
      this.reverb = new this.Tone.Reverb({
        decay: clamp(numberOr(effects.reverbDecay, 2.2), 0.2, 8),
        wet: reverbWet,
      });
      this.reverb.connect(this.limiter);
      this.output = this.reverb;
    } else {
      this.reverb = null;
      this.output = this.limiter;
    }
  }

  buildVoices() {
    for (const voice of this.voices.values()) disposeVoice(voice);
    this.voices.clear();

    for (const [role, config] of Object.entries(this.palette.voices || {})) {
      this.voices.set(role, this.createVoice(role, config));
    }
  }

  createVoice(role, config = {}) {
    const Tone = this.Tone;
    const synthType = String(config.synth || "sine");
    const synthClass = synthClassFor(Tone, synthType);
    const synth = synthType === "pluck" && Tone.PluckSynth
      ? new Tone.PluckSynth()
      : new Tone.PolySynth(synthClass);
    const filter = new Tone.Filter(numberOr(config.cutoff, 9000), "lowpass");
    const gain = new Tone.Gain(clamp(numberOr(config.gain, 0.62), 0.001, 1.2));

    try {
      synth.set(optionsForSynth(synthType, config));
    } catch (error) {
      console.warn(`[LilyVoiceEngine] could not apply ${role} synth options:`, error);
    }

    synth.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    return {
      role,
      synth,
      filter,
      gain,
      gainValue: clamp(numberOr(config.gain, 0.62), 0.001, 1.2),
      cutoff: config.cutoff,
      duration: clamp(numberOr(config.duration, 0.24), 0.04, 2.8),
    };
  }
}

function synthClassFor(Tone, synthType) {
  if (synthType === "fm") return Tone.FMSynth;
  if (synthType === "pluck" && Tone.PluckSynth) return Tone.PluckSynth;
  if (synthType === "mono") return Tone.MonoSynth;
  return Tone.Synth;
}

function optionsForSynth(synthType, config) {
  if (synthType === "marimba") {
    return {
      oscillator: { type: "sine" },
      envelope: envelopeFor(config, { attack: 0.004, decay: 0.2, sustain: 0.05, release: 0.5 }),
    };
  }
  if (synthType === "fm") {
    return {
      harmonicity: 2.5,
      modulationIndex: 6,
      envelope: envelopeFor(config, { attack: 0.004, decay: 0.18, sustain: 0.1, release: 0.7 }),
    };
  }
  if (synthType === "pluck") {
    return {
      attackNoise: 0.6,
      dampening: 4200,
      resonance: 0.84,
    };
  }
  return {
    oscillator: { type: oscillatorFor(synthType) },
    envelope: envelopeFor(config, { attack: 0.01, decay: 0.22, sustain: 0.08, release: 0.5 }),
  };
}

function envelopeFor(config, fallback) {
  return {
    attack: clamp(numberOr(config.attack, fallback.attack), 0.001, 1),
    decay: clamp(numberOr(config.decay, fallback.decay), 0.01, 2),
    sustain: clamp(numberOr(config.sustain, fallback.sustain), 0, 1),
    release: clamp(numberOr(config.release, fallback.release), 0.02, 3),
  };
}

function oscillatorFor(synthType) {
  if (["sine", "triangle", "square", "sawtooth"].includes(synthType)) return synthType;
  if (synthType === "saw") return "sawtooth";
  return "sine";
}

function roleFor(role) {
  return ["sourcePulse", "pluck", "bell", "padTail", "bassRoot"].includes(role) ? role : "pluck";
}

function disposeVoice(voice) {
  for (const node of [voice.synth, voice.filter, voice.gain]) {
    disposeAudioNode(node);
  }
}

function disposeAudioNode(node) {
  if (node?.dispose) node.dispose();
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
