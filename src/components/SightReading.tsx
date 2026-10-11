import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { autoCorrelate } from '../audio/pitch';
import { hapticCue, playCue, playReferenceTone } from '../audio/tone';
import { useWakeLock } from '../hooks/useWakeLock';
import CatFace, { type CatMood } from './CatFace';
import CentsStrip from './CentsStrip';
import Fingerboard from './Fingerboard';
import ScoreView from './ScoreView';
import NoteAccuracy from './NoteAccuracy';
import ReadingSettings from './ReadingSettings';
import SessionHistory from './SessionHistory';
import { clampA4, DEFAULT_A4 } from './TunerSettings';
import { NoteMatcher, toPitchFrame } from '../reading/matcher';
import {
  describeDrift,
  exerciseReducer,
  INITIAL_LINE_STATE,
  lineDrift,
  lineScore,
} from '../reading/exercise';
import { shareCsv, statsToCsv } from '../reading/exportStats';
import { mulberry32 } from '../reading/generator';
import { dayOf, loadHistory, saveHistory, withLineResult, type History } from '../reading/history';
import { planLine } from '../reading/lineplan';
import type { GuideNote } from '../reading/renderScore';
import { keyAlterations, keyLabel, midiToName, vexKeySignature } from '../reading/theory';
import { fingeringFor, guideNote, positionLabel, positionOrdinal } from '../reading/violin';
import {
  fingerKey,
  loadFingerStats,
  loadNoteStats,
  saveFingerStats,
  saveNoteStats,
  withNoteResult,
  withResult,
  type NoteResult,
  type NoteStats,
} from '../reading/noteStats';
import {
  loadReadingSettings,
  positionStrings,
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
  inTune: number;
  shifts: number;
  shiftsClean: number;
}

const EMPTY_SESSION: SessionStats = { lines: 0, notes: 0, firstTry: 0, inTune: 0, shifts: 0, shiftsClean: 0 };

export default function SightReading() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(loadReadingSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState<SessionStats>(EMPTY_SESSION);
  const [noteStats, setNoteStats] = useState<NoteStats>(loadNoteStats);
  const [fingerStats, setFingerStats] = useState<NoteStats>(loadFingerStats);
  const [history, setHistory] = useState<History>(loadHistory);
  const [heard, setHeard] = useState<{ midi: number; cents: number } | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [happyFlash, setHappyFlash] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const [line, dispatch] = useReducer(exerciseReducer, INITIAL_LINE_STATE);

  useWakeLock(listening);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const matcherRef = useRef(new NoteMatcher());
  const lineRef = useRef(line);
  lineRef.current = line;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const noteStatsRef = useRef(noteStats);
  noteStatsRef.current = noteStats;
  const wrongTimer = useRef(0);
  const happyTimer = useRef(0);
  const lastHeardUpdate = useRef(0);

  // apply the intonation tolerance and settle time without losing the current target
  useEffect(() => {
    matcherRef.current = new NoteMatcher({
      maxCentsOff: settings.intonationTolerance,
      minInTuneMs: settings.settleMs,
    });
    const current = lineRef.current;
    matcherRef.current.setTarget(
      current.phase === 'playing' ? current.notes[current.cursor]?.midi ?? null : null,
    );
  }, [settings.intonationTolerance, settings.settleMs]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveReadingSettings(next);
  }, []);

  const newLine = useCallback(() => {
    const rng = mulberry32(Math.floor(Math.random() * 0xffffffff));
    const plan = planLine(settings, noteStatsRef.current, rng);
    matcherRef.current.reset();
    matcherRef.current.setTarget(plan.notes[0].midi);
    setWrongFlash(false);
    dispatch({ type: 'NEW_LINE', ...plan });
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

  function cue(kind: 'correct' | 'wrong') {
    const mode = settingsRef.current.cue;
    if (mode === 'sound' || mode === 'both') void playCue(kind);
    if (mode === 'haptic' || mode === 'both') hapticCue(kind);
  }

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

        const now = performance.now();
        const hz = autoCorrelate(buf, ctx.sampleRate);
        const frame = hz > 0 ? toPitchFrame(hz, rms, a4, now) : null;

        if (now - lastHeardUpdate.current >= HEARD_UPDATE_MS) {
          lastHeardUpdate.current = now;
          setHeard(frame ? { midi: frame.midi, cents: Math.round(frame.cents) } : null);
        }

        const event = matcherRef.current.process(frame);
        if (event && lineRef.current.phase === 'playing') {
          if (event.type === 'correct') {
            const current = lineRef.current;
            const i = current.cursor;
            const wasOff = current.outOfTuneCounts[i] > 0;
            const result: NoteResult = {
              missed: current.wrongCounts[i] > 0,
              outOfTuneCents: wasOff ? current.outOfTuneCents[i] : null,
              cents: wasOff ? current.outOfTuneCents[i] : event.cents,
            };
            const position = current.positions[i];
            setNoteStats((s) => withNoteResult(s, current.notes[i], position, result));
            if (position !== null) {
              const fingering = fingeringFor(current.notes[i], position, settingsRef.current.useOpenStrings);
              if (fingering) {
                setFingerStats((s) => withResult(s, fingerKey(fingering.finger, position), result));
              }
            }
            const nextCursor = current.cursor + 1;
            matcherRef.current.setTarget(
              nextCursor < current.notes.length ? current.notes[nextCursor].midi : null,
            );
            dispatch({ type: 'NOTE_CORRECT', cents: event.cents });
            cue('correct');
            setHappyFlash(true);
            window.clearTimeout(happyTimer.current);
            happyTimer.current = window.setTimeout(() => setHappyFlash(false), HAPPY_FLASH_MS);
          } else if (event.type === 'outOfTune') {
            // hold the line: the note turns yellow until it is bent into tune
            dispatch({ type: 'NOTE_OUT_OF_TUNE', cents: event.cents });
          } else {
            dispatch({ type: 'NOTE_WRONG' });
            cue('wrong');
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

  useEffect(() => {
    saveFingerStats(fingerStats);
  }, [fingerStats]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // record stats when a line completes, and auto-advance unless paused
  useEffect(() => {
    if (line.phase !== 'summary') return;
    const finished = lineRef.current;
    const score = lineScore(finished);
    setStats((s) => ({
      lines: s.lines + 1,
      notes: s.notes + score.total,
      firstTry: s.firstTry + score.firstTry,
      inTune: s.inTune + score.inTune,
      shifts: s.shifts + score.shifts,
      shiftsClean: s.shiftsClean + score.shiftsClean,
    }));
    setHistory((h) => withLineResult(h, dayOf(new Date()), finished.position, score));
    if (settingsRef.current.pauseAfterLine) return;
    const timer = window.setTimeout(() => newLine(), AUTO_NEXT_MS);
    return () => window.clearTimeout(timer);
    // newLine is stable for the lifetime of a given summary phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.phase]);

  const displayStatuses =
    wrongFlash && line.phase === 'playing'
      ? line.statuses.map((s, i) => (i === line.cursor ? ('wrongFlash' as const) : s))
      : line.statuses;

  // fingerings follow the position each note was generated in, not the settings
  const position = line.position;
  const allFingerings = useMemo(
    () =>
      position !== null
        ? line.notes.map((n, i) => {
            const p = line.positions[i];
            return p === null ? null : fingeringFor(n, p, settings.useOpenStrings);
          })
        : null,
    [line.notes, line.positions, position, settings.useOpenStrings],
  );
  const fingeringsVisible = (i: number): boolean => {
    switch (settings.fingeringDisplay) {
      case 'off':
        return false;
      case 'always':
        return true;
      case 'tap':
        return line.revealAll;
      case 'after-miss':
        return line.revealAll || line.revealed[i];
    }
  };
  const fingerings = useMemo(
    () => allFingerings?.map((f, i) => (f && fingeringsVisible(i) ? f : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFingerings, settings.fingeringDisplay, line.revealAll, line.revealed],
  );
  const guideNotes = useMemo<(GuideNote | null)[] | undefined>(() => {
    if (!settings.showGuideNotes || line.shifts.length === 0 || !allFingerings) return undefined;
    const alterations = keyAlterations(line.key);
    return line.notes.map((_, i) => {
      if (!line.shifts.includes(i)) return null;
      const from = allFingerings[i - 1];
      const to = line.positions[i];
      if (!from || to === null) return null;
      const note = guideNote(from, to, line.key);
      if (!note) return null;
      return { note, accidental: note.acc === (alterations[note.letter] ?? '') ? null : note.acc };
    });
  }, [settings.showGuideNotes, line.shifts, line.notes, line.positions, line.key, allFingerings]);

  // the position a shifting line moves between (the first one that differs from the target)
  const originPosition =
    line.shifts.length > 0 ? line.positions.find((p) => p !== null && p !== position) ?? null : null;
  const currentPosition = line.phase === 'playing' ? line.positions[line.cursor] ?? null : position;
  const currentFingering = line.phase === 'playing' ? allFingerings?.[line.cursor] ?? null : null;
  const canTapForFingerings =
    position !== null &&
    (settings.fingeringDisplay === 'tap' || settings.fingeringDisplay === 'after-miss');

  const score = lineScore(line);
  const drift = line.phase === 'summary' ? lineDrift(line.cents) : null;
  const accuracy = stats.notes > 0 ? Math.round((stats.firstTry / stats.notes) * 100) : null;
  const intonation = stats.notes > 0 ? Math.round((stats.inTune / stats.notes) * 100) : null;
  const checkingIntonation = settings.intonationTolerance !== null;
  const holdingOutOfTune =
    line.phase === 'playing' && line.statuses[line.cursor] === 'outOfTune' && heard !== null;
  const tuningHint = holdingOutOfTune
    ? heard.cents > 0
      ? ' · too sharp, ease down'
      : ' · too flat, push up'
    : '';
  const positionText =
    position === null
      ? null
      : originPosition !== null && originPosition !== position
        ? `${positionOrdinal(originPosition)} ${line.shifts.length > 1 ? '↔' : '→'} ${positionLabel(position)}`
        : positionLabel(position);
  const purrfect =
    score.firstTry === score.total &&
    (!checkingIntonation || score.inTune === score.total) &&
    score.shiftsClean === score.shifts;

  const mood: CatMood = !listening
    ? 'sleepy'
    : wrongFlash
      ? 'sad'
      : happyFlash || line.phase === 'summary'
        ? 'happy'
        : 'neutral';

  const hearNote = () => {
    const target = line.notes[line.cursor];
    if (target) void playReferenceTone(target.midi, loadA4());
  };

  const exportStats = async () => {
    const outcome = await shareCsv(
      statsToCsv(noteStats, fingerStats, history),
      `purrfect-pitch-stats-${dayOf(new Date())}.csv`,
    );
    setExportNote(outcome === 'shared' ? 'Stats shared.' : 'Stats downloaded as CSV.');
    window.setTimeout(() => setExportNote(null), 3000);
  };

  const resetStats = () => {
    setNoteStats({});
    setFingerStats({});
  };

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
          <span className="reading-key">
            {keyLabel(line.key)}
            {positionText && <span className="reading-position"> · {positionText}</span>}
          </span>
        ) : (
          <span className="reading-key">&nbsp;</span>
        )}
        {accuracy !== null && (
          <span className="reading-stats">
            {stats.lines} line{stats.lines === 1 ? '' : 's'} · {accuracy}% first try
            {checkingIntonation && intonation !== null && ` · ${intonation}% in tune`}
            {stats.shifts > 0 && ` · ${stats.shiftsClean}/${stats.shifts} shifts clean`}
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
            {settings.position !== null && (
              <p className="hint">
                {settings.position === 'odd'
                  ? 'Each line picks an odd-numbered position'
                  : settings.position === 'all'
                    ? 'Each line picks a position from 1st to 7th'
                    : `Lines stay within ${positionLabel(settings.position)}`}
                {settings.shifting
                  ? settings.shiftsPerLine > 1
                    ? `, shifting ${settings.shiftsPerLine} times a line`
                    : ', shifting into it partway'
                  : ''}
                {settings.fingeringDisplay === 'always'
                  ? ', with fingerings shown above each note'
                  : settings.fingeringDisplay === 'tap'
                    ? '; tap the staff to reveal fingerings'
                    : settings.fingeringDisplay === 'after-miss'
                      ? '; fingerings appear after a slip'
                      : ''}
                .
              </p>
            )}
            <p className="hint">Start the microphone to begin.</p>
          </div>
        ) : (
          <ScoreView
            notes={line.notes}
            statuses={displayStatuses}
            cursor={line.cursor}
            keySignature={vexKeySignature(line.key)}
            fingerings={fingerings ?? undefined}
            shifts={line.shifts}
            guideNotes={guideNotes}
            onTap={canTapForFingerings ? () => dispatch({ type: 'TOGGLE_REVEAL' }) : undefined}
          />
        )}

        {line.phase === 'summary' && (
          <div className="score-summary" onClick={settings.pauseAfterLine ? newLine : undefined}>
            <span className="score-summary-result">
              {score.firstTry}/{score.total} first try
              {checkingIntonation && ` · ${score.inTune}/${score.total} in tune`}
              {score.shifts > 0 && ` · ${score.shiftsClean}/${score.shifts} shift${score.shifts === 1 ? '' : 's'} clean`}
              {purrfect ? ' · purrfect!' : ''}
            </span>
            {drift && checkingIntonation && (
              <span className="score-summary-drift">{describeDrift(drift)}</span>
            )}
            <span className="hint">
              {settings.pauseAfterLine ? 'tap for the next line' : 'next line in a moment…'}
            </span>
          </div>
        )}
      </div>

      {line.phase !== 'idle' && checkingIntonation && (
        <CentsStrip cents={line.cents} tolerance={settings.intonationTolerance} />
      )}

      {line.phase !== 'idle' && settings.showFingerboard && currentPosition !== null && (
        <Fingerboard
          key_={line.key}
          position={currentPosition}
          otherPosition={
            originPosition !== null && position !== null && originPosition !== position
              ? currentPosition === position
                ? originPosition
                : position
              : null
          }
          strings={positionStrings(settings)}
          current={
            currentFingering && line.phase === 'playing'
              ? { note: line.notes[line.cursor], string: currentFingering.string }
              : null
          }
        />
      )}

      <div className="readout">
        <span className={'freq-readout' + (holdingOutOfTune ? ' out-of-tune' : '')}>
          {heard
            ? `Hearing ${midiToName(heard.midi)} · ${heard.cents > 0 ? '+' : ''}${heard.cents}¢${tuningHint}`
            : listening
              ? canTapForFingerings && !line.revealAll
                ? 'Play the highlighted note… (tap the staff for fingerings)'
                : 'Play the highlighted note…'
              : 'Tap start and play the highlighted note'}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="reading-controls">
        <button className={'primary-btn' + (listening ? ' stop' : '')} onClick={listening ? stop : start}>
          {listening ? 'Stop' : 'Start reading'}
        </button>
        {listening && line.phase === 'playing' && (
          <button className="secondary-btn" onClick={hearNote} aria-label="Hear the target note">
            ♪ Hear it
          </button>
        )}
        {listening && line.phase !== 'idle' && (
          <button
            className={'secondary-btn' + (line.phase === 'summary' && settings.pauseAfterLine ? ' highlight' : '')}
            onClick={newLine}
          >
            {line.phase === 'summary' ? 'Next line' : 'New line'}
          </button>
        )}
      </div>

      <NoteAccuracy
        stats={noteStats}
        fingerStats={fingerStats}
        onReset={resetStats}
        onExport={exportStats}
        exportNote={exportNote}
      />
      <SessionHistory history={history} onReset={() => setHistory({})} />

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
