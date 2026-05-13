/**
 * Date helpers for meeting datetime display.
 *
 * The backend stores meeting times in WIB (Asia/Jakarta) timezone.
 * ISO strings like "2026-05-14T08:00:00.000000Z" mean 08:00 WIB,
 * NOT 08:00 UTC. We must NOT use new Date() which would convert to local time.
 * Instead, parse the ISO string directly.
 */

import { format as dateFnsFormat } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

/**
 * Parse an ISO datetime string as WIB time (no timezone conversion).
 * Returns a Date object with the correct local representation.
 */
function parseWibDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  // Extract components directly from the ISO string
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return new Date(NaN);
  const [, year, month, day, hour, minute, second] = match.map(Number);
  // Create date in local time (no UTC conversion)
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Format a meeting datetime string for display.
 * Parses the ISO string directly to avoid UTC→WIB conversion.
 */
export function formatMeetingDate(iso: string, formatStr: string): string {
  if (!iso) return '—';
  try {
    const date = parseWibDate(iso);
    if (isNaN(date.getTime())) return '—';
    return dateFnsFormat(date, formatStr, { locale: idLocale });
  } catch {
    return '—';
  }
}
