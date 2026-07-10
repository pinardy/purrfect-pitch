// Autocorrelation-based pitch detection (ACF2+ with parabolic interpolation),
// adapted from Chris Wilson's PitchDetect.
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.005) return -1; // too quiet to call it a note

  // Trim leading/trailing low-amplitude samples to sharpen the correlation
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buf.slice(r1, r2);
  const N = trimmed.length;
  if (N < 8) return -1;

  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }

  // Skip the initial peak at lag 0, then find the global maximum
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0 || c[0] <= 0) return -1;

  // Confidence gate: for a genuinely periodic signal the ACF peak approaches
  // the zero-lag energy. Attack transients and noise score much lower and
  // would otherwise produce spurious note jumps.
  if (maxVal / c[0] < 0.85) return -1;

  let period = maxPos;
  const x1 = c[maxPos - 1];
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? x2;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) period = maxPos - b / (2 * a);

  const freq = sampleRate / period;
  // Reject results outside a musically useful range
  if (freq < 27 || freq > 4500) return -1;
  return freq;
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export interface NoteInfo {
  name: string;
  octave: number;
  /** Deviation from the nearest note, -50..+50 */
  cents: number;
  /** Exact frequency of the nearest note at the current A4 reference */
  targetFreq: number;
}

export function freqToNote(freq: number, a4: number): NoteInfo {
  const midi = 12 * Math.log2(freq / a4) + 69;
  const nearest = Math.round(midi);
  return {
    name: NOTE_NAMES[((nearest % 12) + 12) % 12],
    octave: Math.floor(nearest / 12) - 1,
    cents: Math.round((midi - nearest) * 100),
    targetFreq: a4 * 2 ** ((nearest - 69) / 12),
  };
}
