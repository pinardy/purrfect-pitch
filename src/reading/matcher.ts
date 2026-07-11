// Frame-driven note matching: decides when a played pitch registers as an
// attempt at the current target note.

import { freqToMidiFloat } from './theory';

export interface PitchFrame {
  hz: number;
  rms: number;
  /** nearest MIDI note at the current A4 reference */
  midi: number;
  /** cents offset from that nearest note, -50..+50 */
  cents: number;
}

export function toPitchFrame(hz: number, rms: number, a4: number): PitchFrame {
  const midiFloat = freqToMidiFloat(hz, a4);
  const midi = Math.round(midiFloat);
  return { hz, rms, midi, cents: (midiFloat - midi) * 100 };
}

export interface MatcherConfig {
  /** minimum RMS level to count a frame as voiced */
  rmsGate: number;
  /** contiguous same-MIDI frames required before a note registers */
  minStableFrames: number;
  /** contiguous unvoiced frames that re-arm the matcher */
  silenceFrames: number;
  minHz: number;
  maxHz: number;
  /** when set, frames further off than this many cents are treated as unvoiced */
  maxCentsOff: number | null;
}

export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  rmsGate: 0.01,
  minStableFrames: 5,
  silenceFrames: 4,
  minHz: 160,
  maxHz: 1500,
  maxCentsOff: null,
};

export type MatcherEvent =
  | { type: 'correct'; midi: number }
  | { type: 'wrong'; midi: number };

/**
 * Pure frame-driven state machine that decides when a played note registers.
 *
 * A note registers after `minStableFrames` contiguous frames of the same
 * rounded MIDI value. After a correct hit the matcher disarms so a sustained
 * note cannot auto-advance through the next target; it re-arms on a different
 * pitch (fast flowing playing) or after a brief silence. A wrong pitch is
 * flagged once, not per frame.
 */
export class NoteMatcher {
  private config: MatcherConfig;
  private target: number | null = null;

  private armed = true;
  private stableMidi: number | null = null;
  private stableCount = 0;
  private silenceCount = 0;
  private lastAcceptedMidi: number | null = null;
  private wrongEmittedFor = new Set<number>();

  constructor(config: Partial<MatcherConfig> = {}) {
    this.config = { ...DEFAULT_MATCHER_CONFIG, ...config };
  }

  setTarget(midi: number | null): void {
    this.target = midi;
  }

  reset(): void {
    this.armed = true;
    this.stableMidi = null;
    this.stableCount = 0;
    this.silenceCount = 0;
    this.lastAcceptedMidi = null;
    this.wrongEmittedFor.clear();
  }

  private isVoiced(frame: PitchFrame): boolean {
    const c = this.config;
    if (frame.rms < c.rmsGate) return false;
    if (frame.hz < c.minHz || frame.hz > c.maxHz) return false;
    if (c.maxCentsOff !== null && Math.abs(frame.cents) > c.maxCentsOff) return false;
    return true;
  }

  /** Feed one analysis frame; `null` means no pitch was detected this frame. */
  process(frame: PitchFrame | null): MatcherEvent | null {
    if (frame === null || !this.isVoiced(frame)) {
      this.stableMidi = null;
      this.stableCount = 0;
      if (++this.silenceCount >= this.config.silenceFrames) {
        this.armed = true;
        this.wrongEmittedFor.clear();
      }
      return null;
    }

    this.silenceCount = 0;

    if (frame.midi === this.stableMidi) {
      this.stableCount++;
    } else {
      this.stableMidi = frame.midi;
      this.stableCount = 1;
    }

    // A genuinely new pitch re-arms without requiring silence.
    if (this.lastAcceptedMidi !== null && frame.midi !== this.lastAcceptedMidi && !this.armed) {
      this.armed = true;
      this.wrongEmittedFor.clear();
    }

    if (!this.armed || this.target === null) return null;

    if (this.stableCount === this.config.minStableFrames) {
      if (frame.midi === this.target) {
        this.armed = false;
        this.lastAcceptedMidi = frame.midi;
        this.wrongEmittedFor.clear();
        return { type: 'correct', midi: frame.midi };
      }
      if (!this.wrongEmittedFor.has(frame.midi)) {
        this.wrongEmittedFor.add(frame.midi);
        return { type: 'wrong', midi: frame.midi };
      }
    }
    return null;
  }
}
