// Plays a short reference pitch so a learner can hear what a note should
// sound like before (or while) trying to tune into it.

let ctx: AudioContext | null = null;

export function midiToHz(midi: number, a4: number): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Sounds `midi` at the given A4 reference for `seconds` with a soft envelope. */
export async function playReferenceTone(midi: number, a4: number, seconds = 1.2): Promise<void> {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle'; // a little warmer than a sine, still clearly pitched
  osc.frequency.value = midiToHz(midi, a4);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
  gain.gain.setValueAtTime(0.25, now + seconds - 0.25);
  gain.gain.linearRampToValueAtTime(0, now + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + seconds);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/**
 * A very short blip when a note registers (or a lower one for a wrong note).
 * At 40 ms it is far shorter than the ~85 ms a pitch needs to register, so the
 * microphone cannot mistake it for playing.
 */
export async function playCue(kind: 'correct' | 'wrong'): Promise<void> {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = kind === 'correct' ? 1760 : 220;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/** Short vibration where the device supports it (Android browsers; iOS does not). */
export function hapticCue(kind: 'correct' | 'wrong'): void {
  try {
    navigator.vibrate?.(kind === 'correct' ? 20 : [40, 40, 40]);
  } catch {
    // not supported
  }
}

// ---- Drone ----

let drone: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
const DRONE_GAIN = 0.12;

/**
 * A sustained reference pitch. It is a pure sine on purpose: the microphone
 * hears the drone through the speaker, and a single partial can be removed
 * exactly with a notch filter before pitch detection, whereas a richer
 * timbre would leave harmonics inside the violin's range. Calling it again
 * glides to the new pitch instead of restarting.
 */
export async function startDrone(hz: number): Promise<void> {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;
  if (drone) {
    drone.oscs[0].frequency.setTargetAtTime(hz, now, 0.05);
    drone.gain.gain.setTargetAtTime(DRONE_GAIN, now, 0.1);
    return;
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(DRONE_GAIN, now + 0.4);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  drone = { oscs: [osc], gain };
}

export function stopDrone(): void {
  if (!drone || !ctx) return;
  const { oscs, gain } = drone;
  drone = null;
  const now = ctx.currentTime;
  gain.gain.setTargetAtTime(0, now, 0.08);
  for (const osc of oscs) osc.stop(now + 0.5);
  window.setTimeout(() => {
    for (const osc of oscs) osc.disconnect();
    gain.disconnect();
  }, 600);
}

export function isDronePlaying(): boolean {
  return drone !== null;
}
