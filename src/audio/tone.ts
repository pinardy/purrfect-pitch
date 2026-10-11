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
