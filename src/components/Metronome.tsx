import { useEffect, useRef, useState } from 'react';
import { MAX_BPM, MetronomeEngine, MIN_BPM } from '../audio/metronome';
import { useWakeLock } from '../hooks/useWakeLock';
import CatFace from './CatFace';

const MIN_BEATS = 1;
const MAX_BEATS = 8;

function tempoName(bpm: number): string {
  if (bpm < 60) return 'Largo';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 156) return 'Allegro';
  if (bpm < 176) return 'Vivace';
  return 'Presto';
}

export default function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);

  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapsRef = useRef<number[]>([]);

  useWakeLock(playing);

  function engine(): MetronomeEngine {
    if (!engineRef.current) {
      const e = new MetronomeEngine();
      e.onBeat = setActiveBeat;
      engineRef.current = e;
    }
    return engineRef.current;
  }

  useEffect(() => () => engineRef.current?.dispose(), []);
  useEffect(() => {
    if (engineRef.current) engineRef.current.bpm = bpm;
  }, [bpm]);
  useEffect(() => {
    if (engineRef.current) engineRef.current.beatsPerBar = beatsPerBar;
  }, [beatsPerBar]);

  const setTempo = (value: number) =>
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value))));

  function toggle() {
    const e = engine();
    if (playing) {
      e.stop();
      setPlaying(false);
      setActiveBeat(-1);
    } else {
      e.bpm = bpm;
      e.beatsPerBar = beatsPerBar;
      e.start();
      setPlaying(true);
    }
  }

  function tap() {
    const now = performance.now();
    const taps = tapsRef.current;
    // A long pause starts a fresh measurement
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      const avgMs = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      setTempo(60000 / avgMs);
    }
  }

  return (
    <div className="card metronome">
      <div className="cat-stage">
        <div
          className="cat-sway"
          style={{
            transform: `rotate(${playing ? (activeBeat % 2 === 0 ? -8 : 8) : 0}deg)`,
            transitionDuration: `${Math.min(0.35, (60 / bpm) * 0.9)}s`,
          }}
        >
          <CatFace mood={playing ? (activeBeat === 0 ? 'happy' : 'neutral') : 'sleepy'} size={150} />
        </div>
      </div>

      <div className="bpm-display">
        <span className="bpm-value">{bpm}</span>
        <span className="bpm-unit">
          BPM · {tempoName(bpm)}
        </span>
      </div>

      <div className="beat-dots" aria-hidden="true">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={
              'paw' + (i === 0 ? ' accent' : '') + (playing && i === activeBeat ? ' active' : '')
            }
          >
            🐾
          </span>
        ))}
      </div>

      <input
        className="tempo-slider"
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        aria-label="Tempo"
        onChange={(e) => setTempo(Number(e.target.value))}
      />

      <div className="tempo-nudge">
        <button onClick={() => setTempo(bpm - 5)}>−5</button>
        <button onClick={() => setTempo(bpm - 1)}>−1</button>
        <button onClick={() => setTempo(bpm + 1)}>+1</button>
        <button onClick={() => setTempo(bpm + 5)}>+5</button>
      </div>

      <div className="beats-row">
        <span className="field-label">Beats per bar</span>
        <div className="stepper small">
          <button
            aria-label="Fewer beats per bar"
            onClick={() => setBeatsPerBar((b) => Math.max(MIN_BEATS, b - 1))}
          >
            −
          </button>
          <span className="stepper-value">{beatsPerBar}</span>
          <button
            aria-label="More beats per bar"
            onClick={() => setBeatsPerBar((b) => Math.min(MAX_BEATS, b + 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className="transport">
        <button className="tap-btn" onClick={tap}>
          Tap tempo
        </button>
        <button
          className={'primary-btn' + (playing ? ' stop' : '')}
          aria-label={playing ? 'Stop metronome' : 'Start metronome'}
          onClick={toggle}
        >
          {playing ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  );
}
