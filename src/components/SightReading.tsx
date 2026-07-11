import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { autoCorrelate } from '../audio/pitch';
import { useWakeLock } from '../hooks/useWakeLock';
import CatFace, { type CatMood } from './CatFace';
import ScoreView from './ScoreView';
import NoteAccuracy from './NoteAccuracy';
import ReadingSettings from './ReadingSettings';
import { clampA4, DEFAULT_A4 } from './TunerSettings';
import { NoteMatcher, toPitchFrame } from '../reading/matcher';
import { exerciseReducer, INITIAL_LINE_STATE, lineScore } from '../reading/exercise';
import { generateLine, mulberry32 } from '../reading/generator';
import { keyLabel, midiToName, vexKeySignature } from '../reading/theory';
import {
  loadNoteStats,
  saveNoteStats,
  withNoteResult,
  type NoteStats,
} from '../reading/noteStats';
import {
  loadReadingSettings,
  PRESETS,
  randomKey,
  saveReadingSettings,
  type ReadingSettings as Settings,
} from '../reading/settings';

const WRONG_FLASH_MS = 500;
const HAPPY_FLASH_MS = 700;
const HEARD_UPDATE_MS = 66;
const AUTO_NEXT_MS = 3000;

// Shared with the tuner: same reference pitch and mic preference everywhere
const A4_STORAGE_KEY = 'tuner.a4';
const DEVICE_STORAGE_KEY = 'tuner.inputDevice';

function loadA4(): number {
  const stored = Number(localStorage.getItem(A4_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampA4(stored) : DEFAULT_A4;
}

interface SessionStats {
  lines: number;
  notes: number;
  firstTry: number;
}

export default function SightReading() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(loadReadingSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ lines: 0, notes: 0, firstTry: 0 });
  const [noteStats, setNoteStats] = useState<NoteStats>(loadNoteStats);
  const [heard, setHeard] = useState<{ midi: number; cents: number } | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [happyFlash, setHappyFlash] = useState(false);

  const [line, dispatch] = useReducer(exerciseReducer, INITIAL_LINE_STATE);

  useWakeLock(listening);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const matcherRef = useRef(new NoteMatcher());
  const lineRef = useRef(line);
  lineRef.current = line;
  const wrongTimer = useRef(0);
  const happyTimer = useRef(0);
  const lastHeardUpdate = useRef(0);

  // apply intonation strictness without losing the current target
  useEffect(() => {
    matcherRef.current = new NoteMatcher({
      maxCentsOff: settings.strictIntonation ? 30 : null,
    });
    const current = lineRef.current;
    matcherRef.current.setTarget(
      current.phase === 'playing' ? current.notes[current.cursor]?.midi ?? null : null,
    );
  }, [settings.strictIntonation]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveReadingSettings(next);
  }, []);

  const newLine = useCallback(() => {
    const rng = mulberry32(Math.floor(Math.random() * 0xffffffff));
    const key = randomKey(settings, rng);
    const preset = PRESETS[settings.difficulty];
    const notes = generateLine({
      key,
      range: preset.range,
      maxLeap: preset.maxLeap,
      chromaticProb: preset.chromaticProb,
      noteCount: settings.noteCount,
      rng,
    });
    matcherRef.current.reset();
    matcherRef.current.setTarget(notes[0].midi);
    setWrongFlash(false);
    dispatch({ type: 'NEW_LINE', key, notes });
  }, [settings]);

  function stop() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    matcherRef.current.setTarget(null);
    setHeard(null);
    setListening(false);
    dispatch({ type: 'STOP' });
  }

  // Release the microphone and audio context when leaving the tab
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close().catch(() => {});
      window.clearTimeout(wrongTimer.current);
      window.clearTimeout(happyTimer.current);
    },
    [],
  );

  async function start() {
    setError(null);
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    const preferredId = localStorage.getItem(DEVICE_STORAGE_KEY) ?? '';
    const a4 = loadA4();
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: preferredId ? { ...base, deviceId: { exact: preferredId } } : base,
        });
      } catch (err) {
        // The remembered device may be gone — fall back to the default input
        if (!preferredId) throw err;
        stream = await navigator.mediaDevices.getUserMedia({ audio: base });
      }
      const ctx = new AudioContext();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      ctxRef.current = ctx;
      streamRef.current = stream;
      setListening(true);

      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);

        let rms = 0;
        for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / buf.length);

        const hz = autoCorrelate(buf, ctx.sampleRate);
        const frame = hz > 0 ? toPitchFrame(hz, rms, a4) : null;

        const now = performance.now();
        if (now - lastHeardUpdate.current >= HEARD_UPDATE_MS) {
          lastHeardUpdate.current = now;
          setHeard(frame ? { midi: frame.midi, cents: Math.round(frame.cents) } : null);
        }

        const event = matcherRef.current.process(frame);
        if (event && lineRef.current.phase === 'playing') {
          if (event.type === 'correct') {
            const current = lineRef.current;
            setNoteStats((s) =>
              withNoteResult(s, current.notes[current.cursor], current.wrongCounts[current.cursor] > 0),
            );
            const nextCursor = current.cursor + 1;
            matcherRef.current.setTarget(
              nextCursor < current.notes.length ? current.notes[nextCursor].midi : null,
            );
            dispatch({ type: 'NOTE_CORRECT' });
            setHappyFlash(true);
            window.clearTimeout(happyTimer.current);
            happyTimer.current = window.setTimeout(() => setHappyFlash(false), HAPPY_FLASH_MS);
          } else {
            dispatch({ type: 'NOTE_WRONG' });
            setWrongFlash(true);
            window.clearTimeout(wrongTimer.current);
            wrongTimer.current = window.setTimeout(() => setWrongFlash(false), WRONG_FLASH_MS);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError('Microphone access is required for sight reading. Check your browser permissions and try again.');
    }
  }

  // begin the first line once the mic is actually running
  useEffect(() => {
    if (listening && line.phase === 'idle') newLine();
  }, [listening, line.phase, newLine]);

  useEffect(() => {
    saveNoteStats(noteStats);
  }, [noteStats]);

  // record stats + auto-advance when a line completes
  useEffect(() => {
    if (line.phase !== 'summary') return;
    const score = lineScore(lineRef.current);
    setStats((s) => ({
      lines: s.lines + 1,
      notes: s.notes + score.total,
      firstTry: s.firstTry + score.firstTry,
    }));
    const timer = window.setTimeout(() => newLine(), AUTO_NEXT_MS);
    return () => window.clearTimeout(timer);
    // newLine is stable for the lifetime of a given summary phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.phase]);

  const displayStatuses =
    wrongFlash && line.phase === 'playing'
      ? line.statuses.map((s, i) => (i === line.cursor ? ('wrongFlash' as const) : s))
      : line.statuses;

  const score = lineScore(line);
  const accuracy = stats.notes > 0 ? Math.round((stats.firstTry / stats.notes) * 100) : null;
  const mood: CatMood = !listening
    ? 'sleepy'
    : wrongFlash
      ? 'sad'
      : happyFlash || line.phase === 'summary'
        ? 'happy'
        : 'neutral';

  return (
    <div className="card reading">
      <button
        className="icon-btn settings-btn"
        aria-label="Sight reading settings"
        onClick={() => setShowSettings(true)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <circle cx="9" cy="7" r="2.4" fill="var(--bg-card)" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="15" cy="17" r="2.4" fill="var(--bg-card)" />
        </svg>
      </button>

      <div className="cat-stage">
        <CatFace mood={mood} size={110} />
      </div>

      <div className="reading-topline">
        {line.phase !== 'idle' ? (
          <span className="reading-key">{keyLabel(line.key)}</span>
        ) : (
          <span className="reading-key">&nbsp;</span>
        )}
        {accuracy !== null && (
          <span className="reading-stats">
            {stats.lines} line{stats.lines === 1 ? '' : 's'} · {accuracy}% first try
          </span>
        )}
      </div>

      <div className="score-box">
        {line.phase === 'idle' ? (
          <div className="score-placeholder">
            <p>
              Random notes appear on the staff. Play each one on your instrument — the
              cursor moves on when you hit the right pitch.
            </p>
            <p className="hint">Start the microphone to begin.</p>
          </div>
        ) : (
          <ScoreView
            notes={line.notes}
            statuses={displayStatuses}
            cursor={line.cursor}
            keySignature={vexKeySignature(line.key)}
          />
        )}

        {line.phase === 'summary' && (
          <div className="score-summary">
            <span className="score-summary-result">
              {score.firstTry}/{score.total} first try{score.firstTry === score.total ? ' · purrfect!' : ''}
            </span>
            <span className="hint">next line in a moment…</span>
          </div>
        )}
      </div>

      <div className="readout">
        <span className="freq-readout">
          {heard
            ? `Hearing ${midiToName(heard.midi)} · ${heard.cents > 0 ? '+' : ''}${heard.cents}¢`
            : listening
              ? 'Play the highlighted note…'
              : 'Tap start and play the highlighted note'}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="reading-controls">
        <button className={'primary-btn' + (listening ? ' stop' : '')} onClick={listening ? stop : start}>
          {listening ? 'Stop' : 'Start reading'}
        </button>
        {listening && line.phase !== 'idle' && (
          <button className="secondary-btn" onClick={newLine}>
            New line
          </button>
        )}
      </div>

      <NoteAccuracy stats={noteStats} onReset={() => setNoteStats({})} />

      {showSettings && (
        <ReadingSettings
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
