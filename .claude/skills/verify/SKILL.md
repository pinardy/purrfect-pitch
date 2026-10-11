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

With a violin position set (`position: 1..7` in `reading.settings`), the
range comes from `exerciseRange` in `src/reading/settings.ts` instead of the
preset; fingerings render as VexFlow `Annotation` text (finger above, string
numeral below) inside `.score-canvas`, and the staff SVG grows from 170 to
198 px tall. Use a sine test tone for notes above ~A5: a sawtooth confuses the
autocorrelator into octave errors that a real violin does not.

## Observing sight-reading state

The staff is VexFlow SVG inside `.score-canvas`. Note status = `fill`
attribute: correct `#2f9e4d`, missed-then-correct `#e8871e`, wrong flash
`#e0554f` (500 ms), current `#ec5f96`, pending `#5b4636`. Poll counts of
green+orange fills to detect cursor advancement; body text shows
`Hearing <note> · <cents>¢`, key label, and `N/M first try` on the summary
overlay. Settings persist in localStorage `reading.settings` (tuner:
`tuner.a4`, `tuner.inputDevice`).
