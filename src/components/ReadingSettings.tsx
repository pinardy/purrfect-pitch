import type { ReactNode } from 'react';
import type {
  CueMode,
  Difficulty,
  FingeringDisplay,
  PositionSetting,
  ReadingSettings as Settings,
  StringFocus,
} from '../reading/settings';
import {
  INTONATION_TOLERANCES,
  MAX_SHIFTS_PER_LINE,
  PRACTICE_PRESETS,
  SETTLE_TIMES,
  shiftOriginFor,
} from '../reading/settings';
import { MAJOR_TONICS, MINOR_TONICS } from '../reading/theory';
import { POSITIONS, positionLabel, positionOrdinal, VIOLIN_STRINGS, type Position } from '../reading/violin';

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

const CUE_MODES: { value: CueMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'sound', label: 'Sound' },
  { value: 'haptic', label: 'Vibrate' },
  { value: 'both', label: 'Both' },
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

function positionShort(position: PositionSetting): string {
  if (position === null) return 'free range';
  if (position === 'odd') return 'odd positions';
  if (position === 'all') return 'any position';
  return positionLabel(position);
}

/** A collapsible group of settings; the summary line shows the current choices. */
function Section({
  title,
  current,
  open,
  children,
}: {
  title: string;
  current: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="settings-section" open={open}>
      <summary>
        <span className="settings-section-title">{title}</span>
        <span className="settings-section-current">{current}</span>
      </summary>
      <div className="settings-section-body">{children}</div>
    </details>
  );
}

function Chips<T>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="presets" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.label}
          className={'chip' + (o.value === value ? ' active' : '')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function ReadingSettings({ settings, onChange, onClose }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  const activeDifficulty = DIFFICULTIES.find((d) => d.value === settings.difficulty);
  const inPosition = settings.position !== null;
  const difficultyHint =
    inPosition && settings.stringFocus === 'auto'
      ? activeDifficulty?.positionHint
      : inPosition
        ? `${settings.stringFocus} string only${settings.difficulty === 'hard' ? ', with accidentals' : ''}`
        : activeDifficulty?.hint;

  const activePreset = PRACTICE_PRESETS.find((p) =>
    Object.entries(p.apply).every(
      ([key, value]) => JSON.stringify(settings[key as keyof Settings]) === JSON.stringify(value),
    ),
  );

  const readingCurrent = [
    activeDifficulty?.label.toLowerCase(),
    settings.keyMode === 'fixed'
      ? `${settings.fixedKey.tonic} ${settings.fixedKey.mode}`
      : settings.keyMode === 'random-major'
        ? 'major keys'
        : 'major & minor',
    `${settings.noteCount} notes`,
    settings.pauseAfterLine ? 'pause after line' : null,
    settings.focusWeakNotes ? 'weak notes first' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const typicalTarget: Position = typeof settings.position === 'number' ? settings.position : 3;
  const positionCurrent = [
    positionShort(settings.position),
    inPosition && settings.shifting
      ? `shifting from ${positionOrdinal(shiftOriginFor(settings, typicalTarget))}${settings.shiftsPerLine > 1 ? ` ×${settings.shiftsPerLine}` : ''}`
      : null,
    inPosition && settings.stringFocus !== 'auto' ? `${settings.stringFocus} string` : null,
    inPosition ? `fingerings ${FINGERING_DISPLAYS.find((f) => f.value === settings.fingeringDisplay)?.label.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const intonationCurrent = [
    settings.intonationTolerance === null ? 'not checked' : `±${settings.intonationTolerance}¢`,
    settings.intonationTolerance !== null && settings.settleMs > 0 ? `${settings.settleMs / 1000}s settle` : null,
    settings.cue !== 'off' ? `cue: ${CUE_MODES.find((c) => c.value === settings.cue)?.label.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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

        <span className="field-label">Presets</span>
        <div className="presets" role="group" aria-label="Practice presets">
          {PRACTICE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={'chip' + (activePreset?.id === p.id ? ' active' : '')}
              onClick={() => onChange({ ...settings, ...p.apply })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {activePreset
            ? `${activePreset.label}: ${activePreset.hint}.`
            : 'One tap sets several options below for a practice goal; tweak anything afterwards.'}
        </p>

        <Section title="Reading" current={readingCurrent} open>
          <span className="field-label">Difficulty</span>
          <Chips
            ariaLabel="Difficulty"
            options={DIFFICULTIES}
            value={settings.difficulty}
            onChange={(v) => set('difficulty', v)}
          />
          <p className="hint">{difficultyHint}</p>

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
          <Chips
            ariaLabel="Notes per line"
            options={NOTE_COUNTS.map((n) => ({ value: n, label: String(n) }))}
            value={settings.noteCount}
            onChange={(v) => set('noteCount', v)}
          />

          <Check
            checked={settings.pauseAfterLine}
            onChange={(v) => set('pauseAfterLine', v)}
            label="Pause after each line (tap for the next one)"
          />
          <Check
            checked={settings.focusWeakNotes}
            onChange={(v) => set('focusWeakNotes', v)}
            label="Focus on weak notes"
          />
          <p className="hint">
            Weak notes: ones you misread, play out of tune, or have rarely seen come up more
            often, using your all-time stats for the current position.
          </p>
        </Section>

        <Section title="Positions & fingerings" current={positionCurrent}>
          <span className="field-label">Violin position</span>
          <Chips
            ariaLabel="Violin position"
            options={POSITION_CHOICES}
            value={settings.position}
            onChange={(v) => set('position', v)}
          />
          <p className="hint">
            {inPosition
              ? `Every note sits under the hand in ${positionSummary(settings.position)}.`
              : 'Pick a position to keep every note within reach of that hand frame.'}
          </p>

          {inPosition && (
            <>
              <Check
                checked={settings.shifting}
                onChange={(v) => set('shifting', v)}
                label="Practise the shift"
              />
              {settings.shifting && (
                <>
                  <span className="field-label">Shift from</span>
                  <Chips
                    ariaLabel="Shift from position"
                    options={[
                      { value: 'auto' as Position | 'auto', label: 'Auto (1st)' },
                      ...POSITIONS.map((p) => ({ value: p as Position | 'auto', label: positionOrdinal(p) })),
                    ]}
                    value={settings.shiftOrigin}
                    onChange={(v) => set('shiftOrigin', v)}
                  />
                  <span className="field-label">Shifts per line</span>
                  <Chips
                    ariaLabel="Shifts per line"
                    options={Array.from({ length: MAX_SHIFTS_PER_LINE }, (_, i) => ({
                      value: i + 1,
                      label: String(i + 1),
                    }))}
                    value={settings.shiftsPerLine}
                    onChange={(v) => set('shiftsPerLine', v)}
                  />
                  <p className="hint">
                    The line alternates between the two positions and ends in the target. Each
                    shift note gets a dash before its finger and is scored separately. Auto
                    starts in 1st position, or 3rd when the target is 1st.
                  </p>
                  <Check
                    checked={settings.showGuideNotes}
                    onChange={(v) => set('showGuideNotes', v)}
                    label="Show guide notes (small grey note the old finger slides to)"
                  />
                </>
              )}

              <span className="field-label">Strings</span>
              <Chips
                ariaLabel="Strings"
                options={STRING_CHOICES}
                value={settings.stringFocus}
                onChange={(v) => set('stringFocus', v)}
              />
              <Check
                checked={settings.useOpenStrings}
                onChange={(v) => set('useOpenStrings', v)}
                label="Finger open strings as 0 (instead of 4th finger)"
              />

              <span className="field-label">Fingerings</span>
              <Chips
                ariaLabel="Fingerings"
                options={FINGERING_DISPLAYS}
                value={settings.fingeringDisplay}
                onChange={(v) => set('fingeringDisplay', v)}
              />
              <p className="hint">
                {FINGERING_DISPLAYS.find((f) => f.value === settings.fingeringDisplay)?.hint}. The
                string (I = E, II = A, III = D, IV = G) is marked below where it changes.
              </p>
              <Check
                checked={settings.showFingerboard}
                onChange={(v) => set('showFingerboard', v)}
                label="Show fingerboard diagram of the hand frame"
              />
            </>
          )}
        </Section>

        <Section title="Intonation & feedback" current={intonationCurrent}>
          <span className="field-label">Intonation</span>
          <Chips
            ariaLabel="Intonation tolerance"
            options={[
              ...INTONATION_TOLERANCES.map((c) => ({ value: c as number | null, label: `±${c}¢` })),
              { value: null, label: 'Off' },
            ]}
            value={settings.intonationTolerance}
            onChange={(v) => set('intonationTolerance', v)}
          />
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
              <Chips
                ariaLabel="Settle time"
                options={SETTLE_TIMES.map((ms) => ({ value: ms, label: ms === 0 ? 'Quick' : `${ms / 1000}s` }))}
                value={settings.settleMs}
                onChange={(v) => set('settleMs', v)}
              />
              <p className="hint">
                How long a note must stay in tune before it registers, so settling into the
                pitch is rewarded over brushing past it.
              </p>
            </>
          )}

          <span className="field-label">Cue when a note registers</span>
          <Chips ariaLabel="Cue" options={CUE_MODES} value={settings.cue} onChange={(v) => set('cue', v)} />
          <p className="hint">
            A short blip (and a lower one for a wrong note) or a vibration, so you need not
            watch the screen mid-phrase. Vibration works on Android; iPhones do not support it
            in the browser.
          </p>
        </Section>
      </div>
    </div>
  );
}
