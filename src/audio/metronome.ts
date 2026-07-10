export const MIN_BPM = 30;
export const MAX_BPM = 240;

// Lookahead scheduler: a coarse setInterval drives precise Web Audio scheduling,
// so clicks stay on the grid even when the main thread is busy.
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export class MetronomeEngine {
  bpm = 120;
  beatsPerBar = 4;
  /** Fired near the audible click so the UI can highlight the current beat. */
  onBeat: ((beat: number) => void) | null = null;

  private ctx: AudioContext | null = null;
  private timerId: number | null = null;
  private nextNoteTime = 0;
  private beat = 0;

  get isRunning(): boolean {
    return this.timerId !== null;
  }

  start(): void {
    if (this.timerId !== null) return;
    if (!this.ctx) this.ctx = new AudioContext();
    void this.ctx.resume();
    this.beat = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.timerId = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.click(this.nextNoteTime, this.beat);
      const beat = this.beat;
      const delayMs = Math.max(0, (this.nextNoteTime - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isRunning) this.onBeat?.(beat);
      }, delayMs);
      this.nextNoteTime += 60 / this.bpm;
      this.beat = (this.beat + 1) % this.beatsPerBar;
    }
  }

  private click(time: number, beat: number): void {
    const ctx = this.ctx!;
    const accent = beat === 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1568 : 1047;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.55, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
  }
}
