// Which pitch a drone sounds for a key or open string. Drones sit below the
// violin's range (and below the matcher's lowest accepted pitch), so the
// microphone never mistakes them for a played note.

import type { DroneMode } from './settings';
import type { Key } from './theory';
import { VIOLIN_STRINGS } from './violin';

const TONIC_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/**
 * MIDI note of the drone, or null when off: always between E2 (82 Hz) and
 * E3 (165 Hz), under the matcher's 180 Hz floor. The mic input is also
 * notched at this frequency so the drone cannot upset pitch detection.
 */
export function droneMidi(mode: DroneMode, key: Key): number | null {
  if (mode === 'off') return null;
  if (mode === 'tonic') {
    const pc = TONIC_PC[key.tonic] ?? 0;
    return pc <= 4 ? 48 + pc : 36 + pc;
  }
  const string = VIOLIN_STRINGS.find((s) => s.name === mode);
  if (!string) return null;
  // the open string dropped by octaves until it is below the violin's range
  let midi = 12 * (string.octave + 1) + TONIC_PC[string.letter];
  while (midi > 52) midi -= 12; // 52 = E3, 165 Hz
  return midi;
}

export function droneLabel(mode: DroneMode, key: Key): string | null {
  if (mode === 'off') return null;
  return mode === 'tonic' ? `${key.tonic} drone` : `${mode} string drone`;
}
