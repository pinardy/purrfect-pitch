// Export of all-time stats as CSV, shared via the system share sheet where
// available and downloaded otherwise.

import type { History } from './history';
import type { NoteStats } from './noteStats';
import { averageCents, intonationTendency, parseFingerKey, parseStatKey } from './noteStats';

function csvRow(cells: (string | number)[]): string {
  return cells
    .map((c) => {
      const text = String(c);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(',');
}

export function statsToCsv(noteStats: NoteStats, fingerStats: NoteStats, history: History): string {
  const lines: string[] = [];
  lines.push('# Notes');
  lines.push(csvRow(['note', 'position', 'attempts', 'misses', 'out_of_tune', 'sharp', 'flat', 'avg_cents', 'tendency']));
  for (const [key, s] of Object.entries(noteStats)) {
    const { name, position } = parseStatKey(key);
    lines.push(
      csvRow([
        name,
        position ?? 'free',
        s.attempts,
        s.misses,
        s.outOfTune ?? 0,
        s.sharp ?? 0,
        s.flat ?? 0,
        averageCents(s).toFixed(1),
        intonationTendency(s) ?? '',
      ]),
    );
  }
  lines.push('');
  lines.push('# Fingers');
  lines.push(csvRow(['finger', 'position', 'attempts', 'misses', 'out_of_tune', 'sharp', 'flat', 'avg_cents', 'tendency']));
  for (const [key, s] of Object.entries(fingerStats)) {
    const { finger, position } = parseFingerKey(key);
    lines.push(
      csvRow([
        finger,
        position,
        s.attempts,
        s.misses,
        s.outOfTune ?? 0,
        s.sharp ?? 0,
        s.flat ?? 0,
        averageCents(s).toFixed(1),
        intonationTendency(s) ?? '',
      ]),
    );
  }
  lines.push('');
  lines.push('# History');
  lines.push(csvRow(['day', 'position', 'lines', 'notes', 'first_try', 'in_tune', 'shifts', 'shifts_clean']));
  for (const day of Object.keys(history).sort()) {
    for (const [position, r] of Object.entries(history[day])) {
      if (!r) continue;
      lines.push(csvRow([day, position, r.lines, r.notes, r.firstTry, r.inTune, r.shifts ?? 0, r.shiftsClean ?? 0]));
    }
  }
  return lines.join('\n') + '\n';
}

/** Share the CSV through the system share sheet, or download it. */
export async function shareCsv(csv: string, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([csv], filename, { type: 'text/csv' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Purrfect Pitch stats' });
      return 'shared';
    } catch {
      // user cancelled or sharing failed — fall back to a download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
