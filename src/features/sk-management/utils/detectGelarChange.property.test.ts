/**
 * Property-based tests for detectGelarChange utility.
 *
 * Feature: sk-ijazah-upload
 *
 * Properties tested:
 *   Property 4: Deteksi gelar akademik bersifat universal
 *
 * Validates: Requirements 2.2
 */

import { describe, it, expect } from 'vitest';
import { hasGelar, detectGelarChange, GELAR_PATTERN } from './detectGelarChange';

// All recognized academic degrees
const ALL_GELAR = [
  'S.Pd', 'M.Pd', 'S.Ag', 'M.Ag', 'S.T', 'S.Kom',
  'S.E', 'S.H', 'S.Sos', 'M.M', 'M.Si', 'Dr.', 'Prof.',
];

// Name prefixes to combine with degrees
const NAME_PREFIXES = [
  'Ahmad', 'Siti', 'Muhammad', 'Nur', 'Abdul', 'Budi',
  'Dewi', 'Hasan', 'Fatimah', 'Rizki', 'Andi', 'Dian',
];

// Strings that should NOT match any gelar
const NON_GELAR_STRINGS = [
  'Ahmad Fauzi',
  'Siti Rahayu',
  'Muhammad Rizki',
  'Budi Santoso',
  'Dewi Lestari',
  'Hasan Basri',
  'Guru Kelas',
  'Kepala Sekolah',
  'Staf Tata Usaha',
  'Penjaga Sekolah',
  '',
  'S',
  'M',
  'Dr',
  'Prof',
  'SPd',
  'MPd',
  'SAg',
  'ST',
  'SKom',
  'SE',
  'SH',
  'SSos',
  'MM',
  'MSi',
];

describe('detectGelarChange — Property 4: Deteksi gelar akademik bersifat universal', () => {
  /**
   * Property 4a: hasGelar returns true for all names containing a recognized degree
   *
   * FOR ALL recognized gelar strings, when combined with any name prefix,
   * hasGelar MUST return true.
   *
   * Validates: Requirements 2.2
   */
  it('Property 4a: hasGelar returns true for all names containing a recognized degree', () => {
    let iterationCount = 0;

    for (const gelar of ALL_GELAR) {
      for (const prefix of NAME_PREFIXES) {
        // Test "Nama Gelar" format
        expect(hasGelar(`${prefix} ${gelar}`), `"${prefix} ${gelar}" should contain gelar`).toBe(true);

        // Test "Gelar Nama" format (prefix before degree)
        expect(hasGelar(`${gelar} ${prefix}`), `"${gelar} ${prefix}" should contain gelar`).toBe(true);

        // Test degree with a space prefix (to ensure word boundary works)
        expect(hasGelar(` ${gelar}`), `" ${gelar}" should be detected as gelar`).toBe(true);

        iterationCount += 3;
      }
    }

    // Verify we ran at least 100 iterations
    expect(iterationCount).toBeGreaterThanOrEqual(100);
  });

  /**
   * Property 4b: hasGelar returns false for strings without recognized degrees
   *
   * FOR ALL strings that do not contain a recognized gelar pattern,
   * hasGelar MUST return false.
   *
   * Validates: Requirements 2.2
   */
  it('Property 4b: hasGelar returns false for strings without recognized degrees', () => {
    for (const str of NON_GELAR_STRINGS) {
      expect(hasGelar(str), `"${str}" should NOT contain gelar`).toBe(false);
    }
  });

  /**
   * Property 4c: hasGelar is case-insensitive for degree detection
   *
   * The GELAR_PATTERN uses the 'i' flag, so detection should work
   * regardless of case variations.
   *
   * Validates: Requirements 2.2
   */
  it('Property 4c: hasGelar detects degrees in various case forms', () => {
    const caseVariants = [
      'Ahmad S.Pd',
      'Ahmad s.pd',
      'Ahmad S.PD',
      'Ahmad s.PD',
      'Ahmad S.pD',
    ];

    for (const variant of caseVariants) {
      expect(hasGelar(variant), `"${variant}" should be detected`).toBe(true);
    }
  });

  /**
   * Property 4d: detectGelarChange correctly identifies gelar changes in nama
   *
   * FOR ALL cases where the new nama contains a gelar and differs from original,
   * isGelarChange MUST be true.
   *
   * Validates: Requirements 2.2
   */
  it('Property 4d: detectGelarChange detects gelar change when new nama has degree', () => {
    let iterationCount = 0;

    for (const gelar of ALL_GELAR) {
      for (const prefix of NAME_PREFIXES.slice(0, 8)) {
        const originalNama = prefix; // No degree
        const currentNama = `${prefix} ${gelar}`; // With degree

        const result = detectGelarChange(currentNama, originalNama, '', '');

        expect(
          result.isGelarChange,
          `Adding "${gelar}" to "${prefix}" should trigger isGelarChange`
        ).toBe(true);

        iterationCount++;
      }
    }

    expect(iterationCount).toBeGreaterThanOrEqual(100);
  });

  /**
   * Property 4e: detectGelarChange correctly identifies gelar changes when removing degree
   *
   * FOR ALL cases where the original nama contains a gelar and the new nama doesn't,
   * isGelarChange MUST be true.
   *
   * Validates: Requirements 2.2
   */
  it('Property 4e: detectGelarChange detects gelar change when removing degree from nama', () => {
    for (const gelar of ALL_GELAR) {
      const originalNama = `Ahmad ${gelar}`;
      const currentNama = 'Ahmad'; // Degree removed

      const result = detectGelarChange(currentNama, originalNama, '', '');

      expect(
        result.isGelarChange,
        `Removing "${gelar}" from nama should trigger isGelarChange`
      ).toBe(true);
    }
  });

  /**
   * Property 4f: detectGelarChange returns false when nama doesn't change
   *
   * FOR ALL cases where currentNama === originalNama,
   * isGelarChange MUST be false regardless of whether the name contains a degree.
   *
   * Validates: Requirements 2.2
   */
  it('Property 4f: detectGelarChange returns false when nama is unchanged', () => {
    const testNames = [
      'Ahmad Fauzi',
      'Siti Rahayu S.Pd',
      'Muhammad M.Pd',
      'Dr. Budi Santoso',
      'Prof. Hasan',
    ];

    for (const nama of testNames) {
      const result = detectGelarChange(nama, nama, '', '');

      expect(
        result.isGelarChange,
        `Unchanged nama "${nama}" should NOT trigger isGelarChange`
      ).toBe(false);
    }
  });

  /**
   * Property 4g: detectGelarChange correctly detects pendidikan changes
   *
   * FOR ALL cases where currentPendidikan !== originalPendidikan,
   * isPendidikanChange MUST be true.
   *
   * Validates: Requirements 2.1
   */
  it('Property 4g: detectGelarChange detects pendidikan_terakhir changes', () => {
    const pendidikanPairs = [
      ['S1', 'S2'],
      ['SMA', 'S1'],
      ['D3', 'S1'],
      ['S1 Pendidikan', 'S2 Manajemen'],
      ['', 'S1'],
      ['S1', ''],
    ];

    for (const [original, current] of pendidikanPairs) {
      const result = detectGelarChange('Ahmad', 'Ahmad', current, original);

      expect(
        result.isPendidikanChange,
        `Pendidikan change from "${original}" to "${current}" should trigger isPendidikanChange`
      ).toBe(true);
    }
  });

  /**
   * Property 4h: detectGelarChange returns false for isPendidikanChange when unchanged
   *
   * FOR ALL cases where currentPendidikan === originalPendidikan,
   * isPendidikanChange MUST be false.
   *
   * Validates: Requirements 2.1
   */
  it('Property 4h: detectGelarChange returns false for isPendidikanChange when unchanged', () => {
    const pendidikanValues = ['S1', 'S2', 'SMA', 'D3', '', 'S1 Pendidikan Islam'];

    for (const pendidikan of pendidikanValues) {
      const result = detectGelarChange('Ahmad', 'Ahmad', pendidikan, pendidikan);

      expect(
        result.isPendidikanChange,
        `Unchanged pendidikan "${pendidikan}" should NOT trigger isPendidikanChange`
      ).toBe(false);
    }
  });

  /**
   * Property 4i: GELAR_PATTERN matches all 13 recognized degrees
   *
   * Validates: Requirements 2.2
   */
  it('Property 4i: GELAR_PATTERN matches all 13 recognized academic degrees', () => {
    for (const gelar of ALL_GELAR) {
      // Test with a name prefix to ensure proper context
      expect(
        GELAR_PATTERN.test(`Ahmad ${gelar}`),
        `GELAR_PATTERN should match "Ahmad ${gelar}"`
      ).toBe(true);
    }

    expect(ALL_GELAR).toHaveLength(13);
  });
});
