const VOICE_SETTINGS = Object.freeze({
  kick: { type: "sine", frequency: 92, endFrequency: 42, duration: 0.28 },
  snare: { type: "triangle", frequency: 210, endFrequency: 145, duration: 0.16 },
  hat: { type: "square", frequency: 5200, endFrequency: 3600, duration: 0.055 },
  tom: { type: "sine", frequency: 180, endFrequency: 92, duration: 0.25 },
  clap: { type: "sawtooth", frequency: 780, endFrequency: 360, duration: 0.12 },
  bell: { type: "sine", frequency: 880, endFrequency: 660, duration: 0.48 },
});

export class ConsoleAudioEngine {
  constructor({ createContext = defaultContextFactory } = {}) {
    this.createContext = createContext;
    this.context = null;
    this.master = null;
    this.masterGain = 0.82;
    this.buffers = new Map();
  }

  get ready() {
    return !!this.context && this.context.state === "running";
  }

  async arm() {
    if (!this.context) {
      this.context = this.createContext();
      if (!this.context) throw new Error("当前浏览器不支持 Web Audio");
      this.master = this.context.createGain();
      this.master.gain.value = this.masterGain;
      this.master.connect(this.context.destination);
    }
    if (this.context.state !== "running") await this.context.resume();
    return this.ready;
  }

  setMasterGain(value) {
    this.masterGain = clamp(Number(value), 0, 1, this.masterGain);
    if (this.master) this.master.gain.value = this.masterGain;
  }

  async loadSample(slotId, data) {
    await this.arm();
    const arrayBuffer = await audioDataToArrayBuffer(data);
    const decoded = await this.context.decodeAudioData(arrayBuffer.slice(0));
    this.buffers.set(slotId, decoded);
    return decoded;
  }

  removeSample(slotId) {
    this.buffers.delete(slotId);
  }

  trigger(slot, velocity = 0.9) {
    if (!this.ready || !slot?.id) return false;
    const level = clamp(Number(slot.gain), 0, 1, 0.86) * clamp(Number(velocity), 0.1, 1, 0.9);
    const buffer = this.buffers.get(slot.id);
    if (buffer) {
      this.triggerSample(buffer, level);
    } else {
      this.triggerFallback(slot.fallbackVoice, level);
    }
    return true;
  }

  triggerSample(buffer, level) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(level, this.context.currentTime);
    source.connect(gain);
    gain.connect(this.master);
    source.start(this.context.currentTime);
  }

  triggerFallback(voiceId, level) {
    const voice = VOICE_SETTINGS[voiceId] || VOICE_SETTINGS.tom;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, voice.endFrequency), now + voice.duration);
    gain.gain.setValueAtTime(Math.max(0.0001, level * 0.54), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + voice.duration + 0.02);
  }
}

async function audioDataToArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  if (data && typeof data.arrayBuffer === "function") return data.arrayBuffer();
  if (typeof data === "string" && data.startsWith("data:audio/")) {
    const response = await fetch(data);
    return response.arrayBuffer();
  }
  throw new Error("无法读取音效数据");
}

function defaultContextFactory() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
