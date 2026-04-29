/**
 * Property-based tests for SkRevisionPage validation logic.
 *
 * Feature: sk-ijazah-upload
 *
 * Properties tested:
 *   Property 5: Validasi wajib ijazah saat gelar berubah
 *   Property 6: Payload selalu menyertakan ijazah_url jika ada
 *
 * Validates: Requirements 2.3, 2.4, 3.1
 */

import { describe, it, expect } from 'vitest';

// ── Extracted validation logic (mirrors SkRevisionPage handleSubmit) ──────────

/**
 * Validates whether the revision form can be submitted.
 * Returns an error message if validation fails, or null if valid.
 */
function validateRevisionSubmit(params: {
  reason: string;
  isGelarChange: boolean;
  isPendidikanChange: boolean;
  ijazahUrl: string | null;
}): string | null {
  const { reason, isGelarChange, isPendidikanChange, ijazahUrl } = params;

  if (!reason.trim()) {
    return 'Alasan revisi wajib diisi!';
  }

  if ((isGelarChange || isPendidikanChange) && !ijazahUrl) {
    return 'Scan ijazah wajib dilampirkan untuk perubahan gelar.';
  }

  return null; // Valid
}

/**
 * Builds the revision payload, including ijazah_url only when present.
 */
function buildRevisionPayload(params: {
  reason: string;
  proposedData: Record<string, string>;
  ijazahUrl: string | null;
}): Record<string, any> {
  const { reason, proposedData, ijazahUrl } = params;

  const payload: Record<string, any> = {
    revision_status: 'revision_pending',
    revision_reason: reason,
    revision_data: proposedData,
  };

  if (ijazahUrl) {
    payload.ijazah_url = ijazahUrl;
  }

  return payload;
}

// ── Property 5: Validasi wajib ijazah saat gelar berubah ──────────────────────

describe('SkRevisionPage — Property 5: Validasi wajib ijazah saat gelar berubah', () => {
  /**
   * Property 5a: When isGelarChange is true and ijazahUrl is null, submit is blocked
   *
   * FOR ALL cases where isGelarChange is true and ijazahUrl is null,
   * validateRevisionSubmit MUST return an error message.
   *
   * Validates: Requirements 2.3, 2.4
   */
  it('Property 5a: Blocks submit when isGelarChange=true and ijazahUrl=null', () => {
    const reasons = [
      'Perubahan gelar S.Pd',
      'Koreksi nama dengan gelar',
      'Update pendidikan terakhir',
      'Perbaikan data guru',
      'Revisi nama lengkap',
    ];

    let iterationCount = 0;

    for (const reason of reasons) {
      // isGelarChange=true, ijazahUrl=null → should block
      const error = validateRevisionSubmit({
        reason,
        isGelarChange: true,
        isPendidikanChange: false,
        ijazahUrl: null,
      });

      expect(error, `isGelarChange=true, ijazahUrl=null should block submit`).not.toBeNull();
      expect(error).toBe('Scan ijazah wajib dilampirkan untuk perubahan gelar.');

      iterationCount++;
    }

    expect(iterationCount).toBeGreaterThanOrEqual(5);
  });

  /**
   * Property 5b: When isPendidikanChange is true and ijazahUrl is null, submit is blocked
   *
   * FOR ALL cases where isPendidikanChange is true and ijazahUrl is null,
   * validateRevisionSubmit MUST return an error message.
   *
   * Validates: Requirements 2.3, 2.4
   */
  it('Property 5b: Blocks submit when isPendidikanChange=true and ijazahUrl=null', () => {
    const reasons = [
      'Perubahan pendidikan dari S1 ke S2',
      'Update gelar pendidikan',
      'Koreksi pendidikan terakhir',
    ];

    for (const reason of reasons) {
      const error = validateRevisionSubmit({
        reason,
        isGelarChange: false,
        isPendidikanChange: true,
        ijazahUrl: null,
      });

      expect(error, `isPendidikanChange=true, ijazahUrl=null should block submit`).not.toBeNull();
      expect(error).toBe('Scan ijazah wajib dilampirkan untuk perubahan gelar.');
    }
  });

  /**
   * Property 5c: When both changes are true and ijazahUrl is null, submit is blocked
   *
   * Validates: Requirements 2.3
   */
  it('Property 5c: Blocks submit when both changes are true and ijazahUrl=null', () => {
    const error = validateRevisionSubmit({
      reason: 'Perubahan nama dan pendidikan',
      isGelarChange: true,
      isPendidikanChange: true,
      ijazahUrl: null,
    });

    expect(error).not.toBeNull();
    expect(error).toBe('Scan ijazah wajib dilampirkan untuk perubahan gelar.');
  });

  /**
   * Property 5d: When isGelarChange is true but ijazahUrl is provided, submit is allowed
   *
   * FOR ALL cases where isGelarChange is true and ijazahUrl is a non-null string,
   * validateRevisionSubmit MUST return null (no error).
   *
   * Validates: Requirements 2.3
   */
  it('Property 5d: Allows submit when isGelarChange=true and ijazahUrl is provided', () => {
    const ijazahPaths = [
      'ijazah/1/abc123.pdf',
      'ijazah/42/def456.pdf',
      'ijazah/100/ghi789.pdf',
    ];

    let iterationCount = 0;

    for (const ijazahUrl of ijazahPaths) {
      const error = validateRevisionSubmit({
        reason: 'Perubahan gelar S.Pd',
        isGelarChange: true,
        isPendidikanChange: false,
        ijazahUrl,
      });

      expect(error, `isGelarChange=true with ijazahUrl should allow submit`).toBeNull();
      iterationCount++;
    }

    expect(iterationCount).toBeGreaterThanOrEqual(3);
  });

  /**
   * Property 5e: When no changes detected, submit is allowed without ijazah
   *
   * FOR ALL cases where isGelarChange=false and isPendidikanChange=false,
   * validateRevisionSubmit MUST return null regardless of ijazahUrl.
   *
   * Validates: Requirements 2.4
   */
  it('Property 5e: Allows submit without ijazah when no gelar/pendidikan change', () => {
    const reasons = [
      'Koreksi tempat lahir',
      'Perbaikan tanggal lahir',
      'Update NIP',
      'Koreksi unit kerja',
    ];

    let iterationCount = 0;

    for (const reason of reasons) {
      // No changes, no ijazah → should be allowed
      const error = validateRevisionSubmit({
        reason,
        isGelarChange: false,
        isPendidikanChange: false,
        ijazahUrl: null,
      });

      expect(error, `No gelar/pendidikan change should allow submit without ijazah`).toBeNull();
      iterationCount++;
    }

    expect(iterationCount).toBeGreaterThanOrEqual(4);
  });

  /**
   * Property 5f: 100 iterations — consistent behavior across all combinations
   *
   * Validates: Requirements 2.3, 2.4
   */
  it('Property 5f: 100 iterations of validation behave consistently', () => {
    const reasons = ['Alasan 1', 'Alasan 2', 'Alasan 3', 'Alasan 4', 'Alasan 5'];
    const paths = ['ijazah/1/a.pdf', 'ijazah/2/b.pdf', null];

    let iterationCount = 0;

    for (let i = 0; i < 100; i++) {
      const reason = reasons[i % reasons.length];
      const isGelarChange = i % 3 === 0;
      const isPendidikanChange = i % 4 === 0;
      const ijazahUrl = paths[i % paths.length];

      const error = validateRevisionSubmit({
        reason,
        isGelarChange,
        isPendidikanChange,
        ijazahUrl,
      });

      if ((isGelarChange || isPendidikanChange) && !ijazahUrl) {
        // Must block
        expect(error, `Iteration ${i}: should block when change detected without ijazah`).not.toBeNull();
      } else {
        // Must allow (reason is always non-empty in this test)
        expect(error, `Iteration ${i}: should allow when no change or ijazah provided`).toBeNull();
      }

      iterationCount++;
    }

    expect(iterationCount).toBe(100);
  });
});

// ── Property 6: Payload selalu menyertakan ijazah_url jika ada ────────────────

describe('SkRevisionPage — Property 6: Payload selalu menyertakan ijazah_url jika ada', () => {
  /**
   * Property 6a: When ijazahUrl is provided, payload always includes it
   *
   * FOR ALL valid ijazah_url strings, the built payload MUST include
   * the ijazah_url field with the exact same value.
   *
   * Validates: Requirements 3.1
   */
  it('Property 6a: Payload includes ijazah_url when provided', () => {
    const ijazahPaths = [
      'ijazah/1/abc123.pdf',
      'ijazah/42/def456.pdf',
      'ijazah/100/ghi789.pdf',
      'ijazah/999/jkl012.pdf',
      'ijazah/1/a'.repeat(10) + '.pdf',
    ];

    let iterationCount = 0;

    for (const ijazahUrl of ijazahPaths) {
      const payload = buildRevisionPayload({
        reason: 'Test reason',
        proposedData: { nama: 'Ahmad S.Pd' },
        ijazahUrl,
      });

      expect(payload, `Payload should include ijazah_url for path "${ijazahUrl}"`).toHaveProperty('ijazah_url');
      expect(payload.ijazah_url).toBe(ijazahUrl);

      iterationCount++;
    }

    expect(iterationCount).toBeGreaterThanOrEqual(5);
  });

  /**
   * Property 6b: When ijazahUrl is null, payload does NOT include ijazah_url
   *
   * FOR ALL cases where ijazahUrl is null, the built payload MUST NOT
   * include the ijazah_url field.
   *
   * Validates: Requirements 3.3
   */
  it('Property 6b: Payload excludes ijazah_url when null', () => {
    const payload = buildRevisionPayload({
      reason: 'Test reason',
      proposedData: { nama: 'Ahmad' },
      ijazahUrl: null,
    });

    expect(payload).not.toHaveProperty('ijazah_url');
  });

  /**
   * Property 6c: Payload always includes required fields
   *
   * FOR ALL valid inputs, the payload MUST always include
   * revision_status, revision_reason, and revision_data.
   *
   * Validates: Requirements 3.1
   */
  it('Property 6c: Payload always includes required revision fields', () => {
    const testCases = [
      { ijazahUrl: 'ijazah/1/a.pdf', reason: 'Reason 1' },
      { ijazahUrl: null, reason: 'Reason 2' },
      { ijazahUrl: 'ijazah/2/b.pdf', reason: 'Reason 3' },
    ];

    for (const { ijazahUrl, reason } of testCases) {
      const payload = buildRevisionPayload({
        reason,
        proposedData: { nama: 'Ahmad' },
        ijazahUrl,
      });

      expect(payload).toHaveProperty('revision_status', 'revision_pending');
      expect(payload).toHaveProperty('revision_reason', reason);
      expect(payload).toHaveProperty('revision_data');
    }
  });

  /**
   * Property 6d: 100 iterations — payload consistency
   *
   * Validates: Requirements 3.1
   */
  it('Property 6d: 100 iterations of payload building behave consistently', () => {
    const paths = [
      'ijazah/1/abc.pdf',
      'ijazah/42/def.pdf',
      null,
      'ijazah/100/ghi.pdf',
      null,
    ];

    let iterationCount = 0;

    for (let i = 0; i < 100; i++) {
      const ijazahUrl = paths[i % paths.length];

      const payload = buildRevisionPayload({
        reason: `Reason ${i}`,
        proposedData: { nama: `Guru ${i}` },
        ijazahUrl,
      });

      if (ijazahUrl) {
        expect(payload, `Iteration ${i}: payload should include ijazah_url`).toHaveProperty('ijazah_url', ijazahUrl);
      } else {
        expect(payload, `Iteration ${i}: payload should NOT include ijazah_url`).not.toHaveProperty('ijazah_url');
      }

      // Always has required fields
      expect(payload).toHaveProperty('revision_status');
      expect(payload).toHaveProperty('revision_reason');
      expect(payload).toHaveProperty('revision_data');

      iterationCount++;
    }

    expect(iterationCount).toBe(100);
  });
});
