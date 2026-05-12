/**
 * Tests for datetime helper functions used in meeting forms.
 * Verifies that timezone conversion does not shift hours.
 */

import { describe, it, expect } from 'vitest';

/**
 * Replicated from MeetingCreatePage/MeetingEditPage.
 * Convert datetime-local string to ISO 8601 with timezone offset.
 * Does NOT use new Date() to parse the input to avoid UTC ambiguity.
 */
function toBackendDatetime(datetimeLocal: string): string {
  if (!datetimeLocal) return datetimeLocal;
  const withSeconds = datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;
  const now = new Date();
  const offsetMin = -now.getTimezoneOffset();
  const pad = (n: number) => String(n).padStart(2, '0');
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offsetStr = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
  return `${withSeconds}${offsetStr}`;
}

/**
 * Convert ISO 8601 datetime from backend to datetime-local input format.
 */
function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

describe('toBackendDatetime', () => {
  it('appends seconds when missing', () => {
    const result = toBackendDatetime('2026-05-12T08:00');
    expect(result).toMatch(/^2026-05-12T08:00:00/);
  });

  it('preserves the exact hour from input without shifting', () => {
    const result = toBackendDatetime('2026-05-12T08:00');
    // The hour in the result must be 08, not shifted by timezone
    expect(result.substring(11, 13)).toBe('08');
  });

  it('preserves the exact minute from input', () => {
    const result = toBackendDatetime('2026-05-12T14:30');
    expect(result.substring(14, 16)).toBe('30');
  });

  it('includes timezone offset in result', () => {
    const result = toBackendDatetime('2026-05-12T08:00');
    // Must end with +HH:MM or -HH:MM
    expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('returns empty string for empty input', () => {
    expect(toBackendDatetime('')).toBe('');
  });

  it('does not double-shift when round-tripping through toDatetimeLocal', () => {
    // Simulate: user inputs 08:00 → send to backend → backend returns UTC → display back
    const userInput = '2026-05-12T08:00';
    const sentToBackend = toBackendDatetime(userInput);

    // Parse the sent value as a Date (simulating what backend stores and returns)
    const backendDate = new Date(sentToBackend);
    const backendIso = backendDate.toISOString(); // UTC format

    // Convert back to datetime-local for display
    const displayedBack = toDatetimeLocal(backendIso);

    // The displayed time must match the original input
    expect(displayedBack).toBe(userInput);
  });

  it('handles noon correctly', () => {
    const result = toBackendDatetime('2026-05-12T12:00');
    expect(result.substring(11, 13)).toBe('12');
  });

  it('handles midnight correctly', () => {
    const result = toBackendDatetime('2026-05-12T00:00');
    expect(result.substring(11, 13)).toBe('00');
  });
});

describe('toDatetimeLocal', () => {
  it('returns empty string for empty input', () => {
    expect(toDatetimeLocal('')).toBe('');
  });

  it('formats ISO UTC datetime to local datetime-local format', () => {
    // Create a date at a known local time
    const localHour = new Date().getHours();
    const now = new Date();
    const result = toDatetimeLocal(now.toISOString());
    // The hour in result should match local hour
    const resultHour = parseInt(result.substring(11, 13));
    expect(resultHour).toBe(localHour);
  });
});
