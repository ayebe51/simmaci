/**
 * Utility functions for detecting academic degree (gelar) changes
 * in teacher revision forms.
 *
 * Feature: sk-ijazah-upload
 * Validates: Requirements 2.1, 2.2
 */

/**
 * Pattern matching academic degrees commonly used in Indonesian education.
 * Matches: S.Pd, M.Pd, S.Ag, M.Ag, S.T, S.Kom, S.E, S.H, S.Sos, M.M, M.Si, Dr., Prof.
 *
 * The pattern matches these degree strings anywhere in a name. The `i` flag makes
 * matching case-insensitive. Degrees ending in a period (Dr., Prof.) are matched
 * by the literal dot in the pattern.
 */
export const GELAR_PATTERN =
  /S\.Pd|M\.Pd|S\.Ag|M\.Ag|S\.T\b|S\.Kom|S\.E\b|S\.H\b|S\.Sos|M\.M\b|M\.Si|Dr\.|Prof\./i;

/**
 * Checks whether a name string contains an academic degree.
 *
 * @param nama - The name string to check
 * @returns true if the name contains a recognized academic degree
 */
export function hasGelar(nama: string): boolean {
  if (!nama) return false;
  return GELAR_PATTERN.test(nama);
}

/**
 * Detects whether a revision involves a change in academic degree or education level.
 *
 * @param currentNama - Current value of the nama field in the form
 * @param originalNama - Original value of the nama field from the database
 * @param currentPendidikan - Current value of pendidikan_terakhir in the form
 * @param originalPendidikan - Original value of pendidikan_terakhir from the database
 * @returns Object with isGelarChange and isPendidikanChange flags
 */
export function detectGelarChange(
  currentNama: string,
  originalNama: string,
  currentPendidikan: string,
  originalPendidikan: string
): { isGelarChange: boolean; isPendidikanChange: boolean } {
  // Detect if nama changed and the new or old value contains a gelar
  const namaChanged = currentNama !== originalNama;
  const isGelarChange =
    namaChanged && (hasGelar(currentNama) || hasGelar(originalNama));

  // Detect if pendidikan_terakhir changed from its original value
  const isPendidikanChange = currentPendidikan !== originalPendidikan;

  return { isGelarChange, isPendidikanChange };
}
