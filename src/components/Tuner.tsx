import { useEffect, useRef, useState } from 'react';
import { autoCorrelate, freqToNote } from '../audio/pitch';
import { useWakeLock } from '../hooks/useWakeLock';
import CatFace, { type CatMood } from './CatFace';
import TunerSettings, { clampA4, DEFAULT_A4 } from './TunerSettings';

const A4_STORAGE_KEY = 'tuner.a4';
const DEVICE_STORAGE_KEY = 'tuner.inputDevice';

function loadA4(): number {
  const stored = Number(localStorage.getItem(A4_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampA4(stored) : DEFAULT_A4;
}

export default function Tuner() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freq, setFreq] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [a4, setA4] = useState(loadA4);
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem(DEVICE_STORAGE_KEY) ?? '');

  useWakeLock(listening);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const smoothedRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const lastHeardRef = useRef(0);

  useEffect(() => {
    localStorage.setItem(A4_STORAGE_KEY, String(clampA4(a4)));
  }, [a4]);

  // Release the microphone and audio context when leaving the tuner
  useEffect(() => stop, []);

  // Keep the microphone list current (e.g. AirPods connecting/disconnecting)
  useEffect(() => {
    const refresh = () => {
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === 'audioinput')))
        .catch(() => {});
    };
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh);
  }, []);

  function stop() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    smoothedRef.current = null;
    historyRef.current = [];
    setFreq(null);
    setLevel(0);
    setListening(false);
  }

  async function start(preferredId: string = deviceId) {
    setError(null);
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
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
      // Re-enumerate now that permission is granted, so labels are populated
      void navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === 'audioinput')))
        .catch(() => {});
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
        // Quantize so silence doesn't trigger a re-render every frame
        setLevel(Math.min(1, Math.round(rms * 100) / 100));

        const detected = autoCorrelate(buf, ctx.sampleRate);
        const now = performance.now();
        if (detected > 0) {
          lastHeardRef.current = now;
          const hist = historyRef.current;
          hist.push(detected);
          if (hist.length > 5) hist.shift();

          // The last few frames must agree with each other before we trust
          // them — a lone outlier (octave error, transient) never moves the
          // display, only a consistently-heard pitch does.
          const recent = hist.slice(-3);
          const consistent =
            recent.length === 3 && Math.max(...recent) / Math.min(...recent) < 1.02;

          const prev = smoothedRef.current;
          if (prev !== null && Math.abs(detected - prev) / prev < 0.03) {
            // Same note: smooth small wobbles
            smoothedRef.current = prev * 0.7 + detected * 0.3;
            setFreq(smoothedRef.current);
          } else if (consistent) {
            // A genuinely new, stable pitch: switch to it
            const sorted = [...recent].sort((a, b) => a - b);
            smoothedRef.current = sorted[1];
            setFreq(smoothedRef.current);
          }
        } else if (now - lastHeardRef.current > 750) {
          smoothedRef.current = null;
          historyRef.current = [];
          setFreq(null);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError('Microphone access is required for the tuner. Check your browser permissions and try again.');
    }
  }

  async function selectDevice(id: string) {
    setDeviceId(id);
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
    if (listening) {
      stop();
      await start(id);
    }
  }

  const note = freq !== null ? freqToNote(freq, clampA4(a4)) : null;
  const cents = note ? Math.max(-50, Math.min(50, note.cents)) : 0;
  const inTune = note !== null && Math.abs(note.cents) <= 5;
  const mood: CatMood = !listening ? 'sleepy' : note ? (inTune ? 'happy' : 'sad') : 'neutral';

  return (
    <div className="card tuner">
      <button
        className="icon-btn settings-btn"
        aria-label="Tuner settings"
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
        <CatFace mood={mood} />
      </div>

      <div className={'note-badge' + (inTune ? ' in-tune' : '')}>
        {note ? (
          <>
            {note.name}
            <sub>{note.octave}</sub>
          </>
        ) : (
          '—'
        )}
      </div>

      <div className="meter" aria-hidden="true">
        <div className="meter-track">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className={'tick' + (i === 5 ? ' center' : '')} />
          ))}
          <div
            className={'needle' + (inTune ? ' in-tune' : '') + (note ? '' : ' hidden')}
            style={{ left: `${50 + cents}%` }}
          />
        </div>
        <div className="meter-labels">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>

      <div className="readout">
        {note && freq !== null ? (
          <>
            <span className={'cents-readout' + (inTune ? ' in-tune' : '')}>
              {note.cents > 0 ? `+${note.cents}` : note.cents} cents
              {inTune ? ' · purrfect!' : ''}
            </span>
            <span className="freq-readout">
              {freq.toFixed(1)} Hz · target {note.targetFreq.toFixed(1)} Hz
            </span>
          </>
        ) : (
          <span className="freq-readout">{listening ? 'Play a note…' : 'Tap start and play a note'}</span>
        )}
      </div>

      {listening && (
        <div className="level-meter" aria-label="Input level">
          <div
            className={'level-fill' + (level >= 0.01 ? ' ok' : '')}
            style={{ width: `${Math.min(100, level * 400)}%` }}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button className={'primary-btn' + (listening ? ' stop' : '')} onClick={listening ? stop : () => start()}>
        {listening ? 'Stop' : 'Start tuning'}
      </button>

      <p className="a4-hint">A4 = {clampA4(a4)} Hz</p>

      {showSettings && (
        <TunerSettings
          a4={a4}
          onChange={setA4}
          devices={devices}
          deviceId={deviceId}
          onSelectDevice={selectDevice}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
