import { lazy, Suspense, useState } from 'react';
import Tuner from './components/Tuner';
import Metronome from './components/Metronome';

// VexFlow is heavy — only load it when the sight-reading tab is opened
const SightReading = lazy(() => import('./components/SightReading'));

type Mode = 'tuner' | 'metronome' | 'reading';

const MODES: { id: Mode; label: string }[] = [
  { id: 'tuner', label: 'Tuner' },
  { id: 'metronome', label: 'Metronome' },
  { id: 'reading', label: 'Sight Read' },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('tuner');

  return (
    <div className="app">
      <h1 className="app-title">🐱 Purrfect Pitch</h1>
      <nav className="mode-toggle" role="tablist" aria-label="Tool">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? 'active' : ''}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <main>
        {mode === 'tuner' ? (
          <Tuner />
        ) : mode === 'metronome' ? (
          <Metronome />
        ) : (
          <Suspense fallback={<div className="card"><p className="hint">Loading…</p></div>}>
            <SightReading />
          </Suspense>
        )}
      </main>
    </div>
  );
}
