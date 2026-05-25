/**
 * Feature: performance-optimization, Property 11: Optimistic update rollback on failure
 *
 * For any SK approval action that fails on the server (HTTP error or network failure),
 * the frontend query cache SHALL revert to the exact state it held before the
 * optimistic update was applied.
 *
 * **Validates: Requirements 8.3**
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { useSkBatchApproval } from '../hooks/useSkBatchApproval';
import { SK_QUERY_KEYS } from '@/features/sk-management/utils/queryKeys';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  skApi: {
    batchUpdateStatus: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { skApi } from '@/lib/api';

/**
 * Arbitrary for generating a single SK document with random properties.
 */
const skDocumentArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  nama: fc.string({ minLength: 1, maxLength: 20 }),
  nomor_sk: fc.string({ minLength: 3, maxLength: 15 }),
  jenis_sk: fc.constantFrom('pengangkatan', 'mutasi', 'pemberhentian'),
  status: fc.constantFrom('pending', 'approved', 'rejected', 'revision'),
  unit_kerja: fc.string({ minLength: 1, maxLength: 15 }),
});

/**
 * Arbitrary for generating a list of SK documents with unique IDs.
 */
const skDocumentListArb = fc
  .array(skDocumentArb, { minLength: 1, maxLength: 10 })
  .map((docs) => {
    // Ensure unique IDs
    const seen = new Set<number>();
    return docs.filter((doc) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
  })
  .filter((docs) => docs.length >= 1);

/**
 * Arbitrary for generating the approval status.
 */
const approvalStatusArb = fc.constantFrom('approved' as const, 'rejected' as const);

/**
 * Arbitrary for generating server error types.
 */
const serverErrorArb = fc.constantFrom(
  new Error('Internal Server Error'),
  new Error('Network Error'),
  new Error('Request timeout'),
  new Error('502 Bad Gateway'),
  new Error('Service Unavailable')
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe('Property 11: Optimistic update rollback on failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cache reverts to exact pre-mutation state on server error (flat array)', async () => {
    await fc.assert(
      fc.asyncProperty(
        skDocumentListArb,
        approvalStatusArb,
        serverErrorArb,
        async (skDocuments, targetStatus, error) => {
          const { queryClient, wrapper } = createWrapper();

          // Set initial cache state
          queryClient.setQueryData(SK_QUERY_KEYS.all, skDocuments);

          // Deep clone the original state for comparison
          const originalState = JSON.parse(JSON.stringify(skDocuments));

          // Pick a subset of IDs to approve (at least 1, up to half)
          const idsToApprove = skDocuments
            .slice(0, Math.max(1, Math.floor(skDocuments.length / 2)))
            .map((doc) => doc.id);

          // Mock API to reject with error
          (skApi.batchUpdateStatus as any).mockRejectedValue(error);

          const { result, unmount } = renderHook(() => useSkBatchApproval(), { wrapper });

          // Trigger mutation
          act(() => {
            result.current.mutate({ ids: idsToApprove, status: targetStatus });
          });

          // Wait for the mutation to complete with error
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          });

          // Assert cache reverted to exact pre-mutation state
          const cachedState = queryClient.getQueryData(SK_QUERY_KEYS.all);
          expect(cachedState).toEqual(originalState);

          unmount();
          queryClient.clear();
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('cache reverts to exact pre-mutation state on server error (paginated shape)', async () => {
    await fc.assert(
      fc.asyncProperty(
        skDocumentListArb,
        approvalStatusArb,
        serverErrorArb,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 10, max: 100 }),
        async (skDocuments, targetStatus, error, currentPage, perPage) => {
          const { queryClient, wrapper } = createWrapper();

          // Create paginated response shape
          const paginatedData = {
            data: skDocuments,
            total: skDocuments.length + 20,
            per_page: perPage,
            current_page: currentPage,
          };

          // Set initial cache state
          queryClient.setQueryData(SK_QUERY_KEYS.all, paginatedData);

          // Deep clone the original state for comparison
          const originalState = JSON.parse(JSON.stringify(paginatedData));

          // Pick a subset of IDs to approve
          const idsToApprove = skDocuments
            .slice(0, Math.max(1, Math.floor(skDocuments.length / 2)))
            .map((doc) => doc.id);

          // Mock API to reject with error
          (skApi.batchUpdateStatus as any).mockRejectedValue(error);

          const { result, unmount } = renderHook(() => useSkBatchApproval(), { wrapper });

          // Trigger mutation
          act(() => {
            result.current.mutate({ ids: idsToApprove, status: targetStatus });
          });

          // Wait for the mutation to complete with error
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          });

          // Assert cache reverted to exact pre-mutation state
          const cachedState = queryClient.getQueryData(SK_QUERY_KEYS.all);
          expect(cachedState).toEqual(originalState);

          unmount();
          queryClient.clear();
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
