import type {
  Difficulty,
  FingeringDisplay,
  PositionSetting,
  ReadingSettings as Settings,
  StringFocus,
} from '../reading/settings';
import { INTONATION_TOLERANCES, SETTLE_TIMES } from '../reading/settings';
import { MAJOR_TONICS, MINOR_TONICS } from '../reading/theory';
import { POSITIONS, positionLabel, positionOrdinal, VIOLIN_STRINGS } from '../reading/violin';

const DIFFICULTIES: { value: Difficulty; label: string; hint: string; positionHint: string }[] = [
  {
    value: 'easy',
    label: 'Easy',
    hint: 'middle of the staff, simple keys',
    positionHint: 'D and A strings only, simple keys',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'full staff, all keys',
    positionHint: 'all four strings, all keys',
  },
  {
    value: 'hard',
    label: 'Hard',
    hint: 'high notes and accidentals',
    positionHint: 'all four strings, with accidentals',
  },
];

const POSITION_CHOICES: { value: PositionSetting; label: string }[] = [
  { value: null, label: 'Free' },
  ...POSITIONS.map((p) => ({ value: p as PositionSetting, label: positionOrdinal(p) })),
  { value: 'odd', label: 'Mix odd' },
  { value: 'all', label: 'Mix all' },
];

const FINGERING_DISPLAYS: { value: FingeringDisplay; label: string; hint: string }[] = [
  { value: 'always', label: 'Always', hint: 'finger numbers above every note' },
  { value: 'tap', label: 'On tap', hint: 'hidden until you tap the staff — test yourself first' },
  { value: 'after-miss', label: 'After a slip', hint: 'shown on a note once you miss it or play it out of tune' },
  { value: 'off', label: 'Off', hint: 'no fingerings' },
];

const STRING_CHOICES: { value: StringFocus; label: string }[] = [
  { value: 'auto', label: 'By difficulty' },
  ...VIOLIN_STRINGS.slice()
    .reverse()
    .map((s) => ({ value: s.name as StringFocus, label: `${s.name} string` })),
];

const NOTE_COUNTS = [4, 8, 12, 16];

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

function positionSummary(position: PositionSetting): string {
  if (position === 'odd') return 'an odd position (1st, 3rd, 5th or 7th) chosen per line';
  if (position === 'all') return 'a position from 1st to 7th chosen per line';
  if (position === null) return '';
  return positionLabel(position);
}

export default function ReadingSettings({ settings, onChange, onClose }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  const activeDifficulty = DIFFICULTIES.find((d) => d.value === settings.difficulty);
  const inPosition = settings.position !== null;
  const activeHint =
    inPosition && settings.stringFocus === 'auto'
      ? activeDifficulty?.positionHint
      : inPosition
        ? `${settings.stringFocus} string only${settings.difficulty === 'hard' ? ', with accidentals' : ''}`
        : activeDifficulty?.hint;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Sight reading settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2>Sight reading settings</h2>
          <button className="icon-btn" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>

        <span className="field-label">Difficulty</span>
        <div className="presets">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              className={'chip' + (d.value === settings.difficulty ? ' active' : '')}
              onClick={() => set('difficulty', d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="hint">{activeHint}</p>

        <span className="field-label">Violin position</span>
        <div className="presets">
          {POSITION_CHOICES.map((p) => (
            <button
              key={p.label}
              className={'chip' + (p.value === settings.position ? ' active' : '')}
              onClick={() => set('position', p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {inPosition
            ? `Every note sits under the hand in ${positionSummary(settings.position)}.`
            : 'Pick a position to keep every note within reach of that hand frame.'}
        </p>

        {inPosition && (
          <>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.shifting}
                onChange={(e) => set('shifting', e.target.checked)}
              />
              <span>Practise the shift</span>
            </label>
            <p className="hint">
              Each line starts in 1st position (3rd when the target is 1st) and shifts into
              the target partway. The shift note gets a dash before its finger.
            </p>
            {settings.shifting && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.showGuideNotes}
                  onChange={(e) => set('showGuideNotes', e.target.checked)}
                />
                <span>Show guide notes (small grey note the old finger slides to)</span>
              </label>
            )}

            <span className="field-label">Strings</span>
            <div className="presets">
              {STRING_CHOICES.map((s) => (
                <button
                  key={s.value}
                  className={'chip' + (s.value === settings.stringFocus ? ' active' : '')}
                  onClick={() => set('stringFocus', s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.useOpenStrings}
                onChange={(e) => set('useOpenStrings', e.target.checked)}
              />
              <span>Finger open strings as 0 (instead of 4th finger)</span>
            </label>

            <span className="field-label">Fingerings</span>
            <div className="presets">
              {FINGERING_DISPLAYS.map((f) => (
                <button
                  key={f.value}
                  className={'chip' + (f.value === settings.fingeringDisplay ? ' active' : '')}
                  onClick={() => set('fingeringDisplay', f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="hint">
              {FINGERING_DISPLAYS.find((f) => f.value === settings.fingeringDisplay)?.hint}. The
              string (I = E, II = A, III = D, IV = G) is marked below where it changes.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.showFingerboard}
                onChange={(e) => set('showFingerboard', e.target.checked)}
              />
              <span>Show fingerboard diagram of the hand frame</span>
            </label>
          </>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.focusWeakNotes}
            onChange={(e) => set('focusWeakNotes', e.target.checked)}
          />
          <span>Focus on weak notes</span>
        </label>
        <p className="hint">
          Notes you misread, play out of tune, or have rarely seen come up more often, using
          your all-time note stats for the current position.
        </p>

        <label className="field-label" htmlFor="key-mode-select">
          Keys
        </label>
        <select
          id="key-mode-select"
          className="mic-select"
          value={settings.keyMode}
          onChange={(e) => set('keyMode', e.target.value as Settings['keyMode'])}
        >
          <option value="random-major">Random major keys</option>
          <option value="random-any">Random major & minor keys</option>
          <option value="fixed">Fixed key</option>
        </select>

        {settings.keyMode === 'fixed' && (
          <select
            className="mic-select"
            aria-label="Fixed key"
            value={`${settings.fixedKey.tonic}|${settings.fixedKey.mode}`}
            onChange={(e) => {
              const [tonic, mode] = e.target.value.split('|');
              set('fixedKey', { tonic, mode: mode as 'major' | 'minor' });
            }}
          >
            {MAJOR_TONICS.map((t) => (
              <option key={`${t}major`} value={`${t}|major`}>{t} major</option>
            ))}
            {MINOR_TONICS.map((t) => (
              <option key={`${t}minor`} value={`${t}|minor`}>{t} minor</option>
            ))}
          </select>
        )}

        <span className="field-label">Notes per line</span>
        <div className="presets">
          {NOTE_COUNTS.map((n) => (
            <button
              key={n}
              className={'chip' + (n === settings.noteCount ? ' active' : '')}
              onClick={() => set('noteCount', n)}
            >
              {n}
            </button>
          ))}
        </div>

        <span className="field-label">Intonation</span>
        <div className="presets">
          {INTONATION_TOLERANCES.map((cents) => (
            <button
              key={cents}
              className={'chip' + (cents === settings.intonationTolerance ? ' active' : '')}
              onClick={() => set('intonationTolerance', cents)}
            >
              ±{cents}¢
            </button>
          ))}
          <button
            className={'chip' + (settings.intonationTolerance === null ? ' active' : '')}
            onClick={() => set('intonationTolerance', null)}
          >
            Off
          </button>
        </div>
        <p className="hint">
          {settings.intonationTolerance === null
            ? 'Any pitch closer to the written note than its neighbours moves the line on.'
            : `A note held more than ${settings.intonationTolerance}¢ off turns yellow and waits until you bend it into tune. It still counts as read correctly, but not as in tune.`}{' '}
          Pitch is measured against the tuner&apos;s A4 reference. Play single notes — pitch
          detection is monophonic.
        </p>

        {settings.intonationTolerance !== null && (
          <>
            <span className="field-label">Settle time</span>
            <div className="presets">
              {SETTLE_TIMES.map((ms) => (
                <button
                  key={ms}
                  className={'chip' + (ms === settings.settleMs ? ' active' : '')}
                  onClick={() => set('settleMs', ms)}
                >
                  {ms === 0 ? 'Quick' : `${ms / 1000}s`}
                </button>
              ))}
            </div>
            <p className="hint">
              How long a note must stay in tune before it registers, so settling into the
              pitch is rewarded over brushing past it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
