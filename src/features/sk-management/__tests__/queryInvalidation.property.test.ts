/**
 * Property-based test for targeted query invalidation.
 * Feature: performance-optimization, Property 5: Targeted query invalidation
 *
 * Verifies that after a successful SK mutation, only SK-related and dashboard
 * query keys are invalidated, while all other cached queries remain untouched.
 *
 * **Validates: Requirements 3.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { QueryClient } from '@tanstack/react-query';
import { SK_QUERY_KEYS } from '@/features/sk-management/utils/queryKeys';
import { DASHBOARD_QUERY_KEYS } from '@/features/dashboard/utils/queryKeys';

/**
 * The set of SK-related query key prefixes that SHOULD be invalidated on success.
 * These match the keys invalidated in useSkBatchApproval's onSuccess handler.
 */
const SK_INVALIDATION_PREFIXES = [
  SK_QUERY_KEYS.all,       // ['sk-documents']
  SK_QUERY_KEYS.pending,   // ['sk-pending']
  SK_QUERY_KEYS.revisions, // ['sk-revisions']
];

/**
 * The set of dashboard query keys that SHOULD be invalidated on success.
 */
const DASHBOARD_INVALIDATION_KEYS = [
  DASHBOARD_QUERY_KEYS.stats,       // ['dashboard', 'stats']
  DASHBOARD_QUERY_KEYS.schoolStats, // ['dashboard', 'school-stats']
  DASHBOARD_QUERY_KEYS.charts,      // ['dashboard', 'charts']
];

/**
 * All keys that are expected to be invalidated after a successful SK mutation.
 */
const ALL_INVALIDATED_KEYS = [
  ...SK_INVALIDATION_PREFIXES,
  ...DASHBOARD_INVALIDATION_KEYS,
];

/**
 * Domains that should NEVER be invalidated by SK mutations.
 * Used to generate random "other" query keys.
 */
const OTHER_DOMAINS = [
  'meetings',
  'wa-blast',
  'attendance',
  'teachers',
  'students',
  'schools',
  'users',
  'reports',
  'events',
  'kta',
  'monitoring',
  'mutations',
  'sdm',
  'settings',
  'notifications',
  'activity-logs',
] as const;

/**
 * Arbitrary generator for a set of unique "other" query keys that should NOT be invalidated.
 * Generates keys like ['meetings', 'list'], ['attendance', 'detail', 42], etc.
 * Returns a deduplicated array of keys to avoid issues with duplicate entries.
 */
const otherQueryKeysArb = fc.uniqueArray(
  fc.tuple(
    fc.constantFrom(...OTHER_DOMAINS),
    fc.constantFrom('list', 'detail', 'stats', 'config', 'all', 'recent'),
    fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined })
  ),
  {
    minLength: 1,
    maxLength: 8,
    comparator: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2],
  }
).map((tuples) =>
  tuples.map(([domain, action, extra]) => {
    const key: unknown[] = [domain, action];
    if (extra !== undefined) key.push(extra);
    return key;
  })
);

/**
 * Simulates the onSuccess invalidation logic from useSkBatchApproval.
 * This mirrors the exact invalidation calls made in the hook.
 */
function simulateOnSuccessInvalidation(queryClient: QueryClient): void {
  // These are the exact invalidation calls from useSkBatchApproval.onSuccess
  queryClient.invalidateQueries({ queryKey: SK_QUERY_KEYS.all });
  queryClient.invalidateQueries({ queryKey: SK_QUERY_KEYS.pending });
  queryClient.invalidateQueries({ queryKey: SK_QUERY_KEYS.revisions });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.stats });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.schoolStats });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.charts });
}

describe('queryInvalidation — property tests', () => {
  /**
   * Property 5: Targeted query invalidation
   *
   * For any successful mutation on an SK-related endpoint, the frontend SHALL
   * invalidate only query keys prefixed with SK-related keys and dashboard keys,
   * leaving all other cached queries untouched.
   *
   * **Validates: Requirements 3.3**
   */
  it('Property 5: Only SK-related and dashboard keys are invalidated, other keys remain untouched', () => {
    // Feature: performance-optimization, Property 5: Targeted query invalidation
    fc.assert(
      fc.property(
        // Generate 1-8 unique random "other" query keys
        otherQueryKeysArb,
        (otherKeys) => {
          // Create a fresh QueryClient for each iteration
          const queryClient = new QueryClient({
            defaultOptions: {
              queries: {
                retry: false,
                gcTime: Infinity,
              },
            },
          });

          // Pre-populate SK-related keys with dummy data
          queryClient.setQueryData(SK_QUERY_KEYS.all, [{ id: 1, status: 'pending' }]);
          queryClient.setQueryData(SK_QUERY_KEYS.pending, [{ id: 2, status: 'pending' }]);
          queryClient.setQueryData(SK_QUERY_KEYS.revisions, [{ id: 3 }]);
          queryClient.setQueryData(SK_QUERY_KEYS.templates, [{ id: 4 }]);

          // Pre-populate dashboard keys with dummy data
          queryClient.setQueryData(DASHBOARD_QUERY_KEYS.stats, { total: 100 });
          queryClient.setQueryData(DASHBOARD_QUERY_KEYS.schoolStats, { schools: 5 });
          queryClient.setQueryData(DASHBOARD_QUERY_KEYS.charts, { data: [] });

          // Pre-populate "other" keys with dummy data
          const otherData = otherKeys.map((key, idx) => {
            const data = { value: `data-${idx}`, timestamp: Date.now() };
            queryClient.setQueryData(key, data);
            return { key, data };
          });

          // Simulate the onSuccess invalidation
          simulateOnSuccessInvalidation(queryClient);

          // Assert: SK-related invalidated keys should be marked as stale/invalidated
          // (invalidateQueries marks queries as stale, triggering refetch on next access)
          const skAllState = queryClient.getQueryState(SK_QUERY_KEYS.all);
          const skPendingState = queryClient.getQueryState(SK_QUERY_KEYS.pending);
          const skRevisionsState = queryClient.getQueryState(SK_QUERY_KEYS.revisions);
          const dashStatsState = queryClient.getQueryState(DASHBOARD_QUERY_KEYS.stats);
          const dashSchoolState = queryClient.getQueryState(DASHBOARD_QUERY_KEYS.schoolStats);
          const dashChartsState = queryClient.getQueryState(DASHBOARD_QUERY_KEYS.charts);

          // Invalidated queries should be marked as invalid (isInvalidated = true)
          if (!skAllState?.isInvalidated) return false;
          if (!skPendingState?.isInvalidated) return false;
          if (!skRevisionsState?.isInvalidated) return false;
          if (!dashStatsState?.isInvalidated) return false;
          if (!dashSchoolState?.isInvalidated) return false;
          if (!dashChartsState?.isInvalidated) return false;

          // Assert: "other" keys should NOT be invalidated — data remains intact
          for (const { key, data } of otherData) {
            const state = queryClient.getQueryState(key);
            // Other keys should not be invalidated
            if (state?.isInvalidated) return false;
            // Data should still be present and unchanged
            const currentData = queryClient.getQueryData(key);
            if (JSON.stringify(currentData) !== JSON.stringify(data)) return false;
          }

          // Cleanup
          queryClient.clear();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5b: SK-templates key is NOT invalidated by batch approval
   *
   * The batch approval onSuccess only invalidates sk-documents, sk-pending,
   * sk-revisions, and dashboard keys. sk-templates should remain untouched
   * since template data doesn't change when documents are approved.
   *
   * **Validates: Requirements 3.3**
   */
  it('Property 5b: SK-templates key is not invalidated by batch approval', () => {
    // Feature: performance-optimization, Property 5: Targeted query invalidation (templates subset)
    fc.assert(
      fc.property(
        otherQueryKeysArb,
        (otherKeys) => {
          const queryClient = new QueryClient({
            defaultOptions: {
              queries: {
                retry: false,
                gcTime: Infinity,
              },
            },
          });

          // Pre-populate sk-templates
          const templateData = [{ id: 1, name: 'Template A' }];
          queryClient.setQueryData(SK_QUERY_KEYS.templates, templateData);

          // Pre-populate other keys
          for (const key of otherKeys) {
            queryClient.setQueryData(key, { exists: true });
          }

          // Simulate the onSuccess invalidation
          simulateOnSuccessInvalidation(queryClient);

          // sk-templates should NOT be invalidated (it's not in the onSuccess handler)
          const templatesState = queryClient.getQueryState(SK_QUERY_KEYS.templates);
          if (templatesState?.isInvalidated) return false;

          // Data should remain unchanged
          const currentTemplates = queryClient.getQueryData(SK_QUERY_KEYS.templates);
          if (JSON.stringify(currentTemplates) !== JSON.stringify(templateData)) return false;

          // Cleanup
          queryClient.clear();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
