/**
 * Feature: performance-optimization
 *
 * Property 14: Document generation partial failure resilience
 * For any set of N teachers where M teachers fail document generation (0 ≤ M ≤ N),
 * exactly N - M documents SHALL be successfully generated, and the failure summary
 * SHALL list exactly M entries with teacher name and error reason.
 * **Validates: Requirements 6.4**
 *
 * Property 15: Batched progress reporting
 * For any document generation of N teachers where N > 0, the progress callback
 * SHALL be invoked ⌈N/5⌉ times, with the completed count monotonically increasing
 * by at most 5 per invocation.
 * **Validates: Requirements 6.1**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  generateSkBatched,
  BATCH_SIZE,
  type Teacher,
  type GenerateOptions,
  type GeneratedDoc,
  type GenerateSingleDocFn,
} from '../utils/generateSkBatched';

/**
 * Arbitrary for generating a teacher with a unique ID and name.
 */
const teacherArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  nama: fc.string({ minLength: 1, maxLength: 30 }),
});

/**
 * Arbitrary for generating a list of N teachers (1-100).
 */
const teacherListArb = fc
  .integer({ min: 1, max: 100 })
  .chain((n) =>
    fc.array(teacherArb, { minLength: n, maxLength: n }).map((teachers) =>
      teachers.map((t, idx) => ({ ...t, id: idx + 1 }))
    )
  );

/**
 * A simple mock generate function that always succeeds.
 */
const successfulGenerateFn: GenerateSingleDocFn = async (teacher, _options) => ({
  teacher,
  blob: new Uint8Array([1, 2, 3]),
  nomorSk: `SK-${teacher.id}`,
});

const defaultOptions: GenerateOptions = {
  templateId: 1,
  tahunAjaran: '2024/2025',
};

describe('Property 15: Batched progress reporting', () => {
  it('progress callback is invoked ⌈N/5⌉ times with monotonically increasing count', async () => {
    await fc.assert(
      fc.asyncProperty(teacherListArb, async (teachers) => {
        const N = teachers.length;
        const expectedCalls = Math.ceil(N / BATCH_SIZE);

        const progressCalls: Array<{ completed: number; total: number }> = [];
        const onProgress = (completed: number, total: number) => {
          progressCalls.push({ completed, total });
        };

        const controller = new AbortController();

        await generateSkBatched(
          teachers,
          defaultOptions,
          successfulGenerateFn,
          onProgress,
          controller.signal
        );

        // Assert progress callback invoked exactly ⌈N/5⌉ times
        expect(progressCalls.length).toBe(expectedCalls);

        // Assert total is always N
        for (const call of progressCalls) {
          expect(call.total).toBe(N);
        }

        // Assert completed count is monotonically increasing
        for (let i = 1; i < progressCalls.length; i++) {
          expect(progressCalls[i].completed).toBeGreaterThan(
            progressCalls[i - 1].completed
          );
        }

        // Assert each increment is at most BATCH_SIZE (5)
        let previousCompleted = 0;
        for (const call of progressCalls) {
          const increment = call.completed - previousCompleted;
          expect(increment).toBeGreaterThan(0);
          expect(increment).toBeLessThanOrEqual(BATCH_SIZE);
          previousCompleted = call.completed;
        }

        // Assert final completed count equals N
        expect(progressCalls[progressCalls.length - 1].completed).toBe(N);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});


/**
 * Arbitrary for generating a list of N teachers (1-50) with unique IDs,
 * paired with M random failure indices.
 */
const teachersWithFailuresArb = fc
  .integer({ min: 1, max: 50 })
  .chain((n) =>
    fc
      .array(teacherArb, { minLength: n, maxLength: n })
      .map((teachers) => teachers.map((t, idx) => ({ ...t, id: idx + 1 })))
      .chain((teachers) =>
        fc
          .subarray(
            Array.from({ length: teachers.length }, (_, i) => i),
            { minLength: 0, maxLength: teachers.length }
          )
          .map((failureIndices) => ({ teachers, failureIndices }))
      )
  );

/**
 * Arbitrary for generating error messages for failures.
 */
const errorMessageArb = fc.constantFrom(
  'Template not found',
  'Invalid teacher data',
  'Network timeout',
  'Docx generation error',
  'Out of memory',
  'Permission denied'
);

describe('Property 14: Document generation partial failure resilience', () => {
  it('generates exactly N-M successes and M failure entries for N teachers with M failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        teachersWithFailuresArb,
        errorMessageArb,
        async ({ teachers, failureIndices }, errorMessage) => {
          const N = teachers.length;
          const M = failureIndices.length;

          // Create a set of teacher IDs that should fail
          const failingTeacherIds = new Set(
            failureIndices.map((idx) => teachers[idx].id)
          );

          // Create a mock generateSingleDoc that fails for selected teachers
          const generateSingleDoc: GenerateSingleDocFn = async (
            teacher: Teacher,
            _options: GenerateOptions
          ): Promise<GeneratedDoc> => {
            if (failingTeacherIds.has(teacher.id)) {
              throw new Error(errorMessage);
            }
            return {
              teacher,
              blob: new Uint8Array([1, 2, 3]),
              nomorSk: `SK-${teacher.id}`,
            };
          };

          // No-op progress callback
          const onProgress = () => {};

          // Non-aborted signal
          const controller = new AbortController();

          const result = await generateSkBatched(
            teachers,
            defaultOptions,
            generateSingleDoc,
            onProgress,
            controller.signal
          );

          // Assert exactly N-M successes
          expect(result.generated.length).toBe(N - M);

          // Assert exactly M failure entries
          expect(result.failures.length).toBe(M);

          // Assert all failure entries have teacher name and error reason
          for (const failure of result.failures) {
            expect(failure.teacher).toBeDefined();
            expect(failure.teacher.nama).toBeDefined();
            expect(typeof failure.teacher.nama).toBe('string');
            expect(failure.error).toBe(errorMessage);
            // Verify the failed teacher is one of the expected failures
            expect(failingTeacherIds.has(failure.teacher.id)).toBe(true);
          }

          // Assert all generated docs correspond to non-failing teachers
          for (const doc of result.generated) {
            expect(failingTeacherIds.has(doc.teacher.id)).toBe(false);
          }

          // Assert total processed equals N
          expect(result.generated.length + result.failures.length).toBe(N);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
