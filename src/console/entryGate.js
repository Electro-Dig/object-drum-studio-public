export class EntryGate {
  constructor() {
    this.activeIds = new Set();
  }

  update(pads = []) {
    const nextActiveIds = new Set();
    const entries = [];

    for (const pad of Array.isArray(pads) ? pads : []) {
      if (!pad || pad.id == null) continue;
      nextActiveIds.add(pad.id);
      if (!this.activeIds.has(pad.id)) entries.push(pad);
    }

    this.activeIds = nextActiveIds;
    return entries;
  }

  reset() {
    this.activeIds.clear();
  }
}
