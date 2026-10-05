/**
 * Procedural audio via the Web Audio API — no asset files to download, which
 * keeps the app tiny and fast to review inside the Pi Browser.
 * SFX are short synthesised blips; music is a gentle looping arpeggio.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  soundOn = true;
  musicOn = true;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  resume(): void { this.ensure(); if (this.ctx?.state === 'suspended') void this.ctx.resume(); }

  private blip(freq: number, dur: number, type: OscillatorType, vol = 0.3): void {
    if (!this.soundOn) return;
    const ctx = this.ensure(); if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
  }

  coin(combo = 1): void { this.blip(660 + Math.min(combo, 12) * 40, 0.12, 'triangle', 0.25); }
  gem(): void { this.blip(880, 0.18, 'sine', 0.3); setTimeout(() => this.blip(1320, 0.15, 'sine', 0.25), 70); }
  power(): void { this.blip(520, 0.2, 'sawtooth', 0.22); setTimeout(() => this.blip(780, 0.2, 'sawtooth', 0.2), 90); }
  jump(): void { this.blip(420, 0.12, 'square', 0.18); }
  slide(): void { this.blip(240, 0.14, 'square', 0.18); }
  lane(): void { this.blip(330, 0.06, 'sine', 0.12); }
  hit(): void { this.blip(140, 0.35, 'sawtooth', 0.35); }
  ui(): void { this.blip(500, 0.06, 'sine', 0.14); }

  startMusic(): void {
    if (!this.musicOn || this.musicTimer != null) return;
    const scale = [261.6, 329.6, 392.0, 523.3, 392.0, 329.6];
    let i = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicOn) return;
      this.blip(scale[i % scale.length], 0.28, 'sine', 0.06);
      i++;
    }, 320);
  }
  stopMusic(): void { if (this.musicTimer != null) { clearInterval(this.musicTimer); this.musicTimer = null; } }

  setSound(on: boolean): void { this.soundOn = on; }
  setMusic(on: boolean): void { this.musicOn = on; if (on) this.startMusic(); else this.stopMusic(); }
}
