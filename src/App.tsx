import { useState } from 'react';
import Tuner from './components/Tuner';
import Metronome from './components/Metronome';

type Mode = 'tuner' | 'metronome';

export default function App() {
  const [mode, setMode] = useState<Mode>('tuner');

  return (
    <div className="app">
      <h1 className="app-title">🐱 Purrfect Pitch</h1>
      <nav className="mode-toggle" role="tablist" aria-label="Tool">
        <button
          role="tab"
          aria-selected={mode === 'tuner'}
          className={mode === 'tuner' ? 'active' : ''}
          onClick={() => setMode('tuner')}
        >
          Tuner
        </button>
        <button
          role="tab"
          aria-selected={mode === 'metronome'}
          className={mode === 'metronome' ? 'active' : ''}
          onClick={() => setMode('metronome')}
        >
          Metronome
        </button>
      </nav>
      <main>{mode === 'tuner' ? <Tuner /> : <Metronome />}</main>
    </div>
  );
}
