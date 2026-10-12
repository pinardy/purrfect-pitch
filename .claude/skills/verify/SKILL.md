---
name: verify
description: Build, launch, and drive purrfect-pitch (tuner/metronome/sight-reading PWA) headlessly to verify changes end-to-end.
---

# Verifying purrfect-pitch

## Build & serve

```sh
npm run build                                   # tsc -b && vite build
npm run preview -- --port 4199 --strictPort     # serves dist at http://localhost:4199/purrfect-pitch/
```

Note the `/purrfect-pitch/` base path. Port 4173 is often already taken — pick another.

## Drive headlessly

No browser automation deps in this repo. Set up a scratchpad project with
`puppeteer-core` and use system Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` with args:
`--autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --mute-audio`.

Buttons have no test ids — click by exact `textContent` ("Sight Read",
"Start reading", "Stop", "New line", "Start tuning").

## Faking the microphone with a controllable pitch

All mic features (tuner, sight reading) read an `AnalyserNode` fed by
`getUserMedia`. Override it in `evaluateOnNewDocument` with an oscillator →
`MediaStreamAudioDestinationNode`, exposing `window.__setTone(hz)`:

```js
navigator.mediaDevices.getUserMedia = async () => {
  const ac = new AudioContext();
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';          // harmonics like a real instrument
  osc.frequency.value = 0.1;      // effectively silent until a tone is set
  const gain = ac.createGain(); gain.gain.value = 0.3;
  const dest = ac.createMediaStreamDestination();
  osc.connect(gain); gain.connect(dest); osc.start();
  window.__setTone = (hz) => { osc.frequency.value = hz; };
  return dest.stream;
};
```

MIDI → Hz: `440 * 2 ** ((midi - 69) / 12)`. A note registers after ~5 stable
frames (~85 ms); allow ~300 ms per note.

## Deterministic sight-reading exercises

`newLine()` seeds mulberry32 from `Math.random()`. Pin `Math.random = () => 0`
in `evaluateOnNewDocument`, then compute the expected line offline from the
real sources (bundle a tiny script with `node_modules/.bin/esbuild x.ts
--bundle --platform=node --format=cjs` that calls `randomKey` +
`generateLine` with `DEFAULT_READING_SETTINGS`). Seed 0 + defaults ⇒
G major: D4 E4 G4 A4 B4 F♯4 G4 A4.

With a violin position set (`position: 1..7 | 'odd' | 'all'` in
`reading.settings`), lines come from `planLine` in `src/reading/lineplan.ts`
(seed 0 + fixed D major + medium + position 3 ⇒ G4 E4 A4 D5 C♯5 F♯4 F♯5 A5;
with `shifting: true` ⇒ A3 C♯4 F♯4 | C♯5 E5 F♯4 A4 D5, shifting at index 3).
Fingerings render as VexFlow `Annotation` text (finger above, string numeral
below; a `–` before the finger marks the shift note, whose guide note is a
flagged grace note with a slur: `.vf-flag`, `.vf-stavetie`) inside
`.score-canvas`, and the staff SVG grows from 170 to 198 px tall.
`fingeringDisplay: 'tap'` shows them only after clicking `.score-line`;
`'after-miss'` only on a note after a wrong or out-of-tune attempt. The
fingerboard diagram is `svg.fingerboard` (`.fb-frame` per string in use,
`.fb-frame.other` for the shift's other position, `.fb-frame.home` for the
1st-position reference when the current position is higher and 1st is not
already the other position, `.fb-ruler-tick.current|lower|higher` for the
position ruler, `.fb-current`), the cents
strip is `.cents-cell[data-grade=ok|off|none]`, the "♪ Hear it" button plays
a reference tone, and `settleMs` delays registration of an in-tune note.
Stats live in `reading.noteStats` keyed `"<note>@<position>"` (bare name for
free lines), per-finger stats in `reading.fingerStats` keyed
`"<finger>@<position>"`, and daily history in `reading.history`; the history
panel is `details.session-history`, and both panels only render once they
have data. Shifting lines carry `shifts: number[]` (indices of the notes
after each shift; `shiftsPerLine` 1–3, `shiftOrigin` a position or 'auto');
with 2 shifts the line starts in the target. `pauseAfterLine: true` keeps the
summary up until `.score-summary` or "Next line" is tapped. "Export CSV"
clicks a hidden anchor (stub `HTMLAnchorElement.prototype.click` to capture
the filename). The settings sheet is `details.settings-section` groups under
a preset chip row. At ≥700 px wide in landscape `.card.reading` becomes a
two-column grid with the fingerboard and cat on the right. Set the tab by
clicking the "Sight Read" button, not via localStorage.

`material: 'scale' | 'arpeggio' | 'thirds' | 'intervals'` replaces random
notes (`planLine` → `generateMaterial`; seed 0 + D major + 3rd position +
scale ⇒ D4 E4 F♯4 G4 A4 B4 C♯5 D5). `showIntervals: true` adds
`.score-canvas text.interval-label` between note pairs (SVG grows 14 px);
interval stats live in `reading.intervalStats` keyed "↑M3". `drone:
'tonic' | 'G' | 'D' | 'A' | 'E'` starts one sine OscillatorNode below 170 Hz
while listening and sets the mic chain's notch BiquadFilterNode to that
frequency (parked at 5 Hz otherwise); `.drone-chip` above the readout
toggles mute. Stub `OscillatorNode.prototype.start` /
`AudioParam.prototype.setTargetAtTime` to observe it; the drone never reaches
the fake mic stream, so the notch is verified offline (see
`autoCorrelate` with a notched synthetic mix) rather than in-browser. Use a sine test tone for notes above ~A5: a sawtooth confuses the
autocorrelator into octave errors that a real violin does not.

## Observing sight-reading state

The staff is VexFlow SVG inside `.score-canvas`. Note status = `fill`
attribute: correct `#2f9e4d`, missed-then-correct `#e8871e`, out of tune
(held, or corrected after being out of tune) `#d9a400`, wrong flash
`#e0554f` (500 ms), current `#ec5f96`, pending `#5b4636`. Poll counts of
green+orange+yellow fills to detect cursor advancement; body text shows
`Hearing <note> · <cents>¢` (plus `· too sharp, ease down` / `· too flat,
push up` while holding out of tune), key label, and `N/M first try · N/M in
tune` on the summary overlay. `reading.settings.intonationTolerance` is the
cents tolerance (null = off); a tone within the same semitone but beyond it
(e.g. +40¢ with ±30) holds the line on a yellow note until the tone is
brought within tolerance — no re-attack needed. Settings persist in localStorage `reading.settings` (tuner:
`tuner.a4`, `tuner.inputDevice`).
