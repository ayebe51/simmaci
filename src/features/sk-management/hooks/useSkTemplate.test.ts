/**
 * Unit tests for useSkTemplate hook
 *
 * Validates: Requirements 6.1, 6.2, 6.4
 *
 * Property 12: Template resolution uses active uploaded template when available
 * Property 13: Template resolution falls back to static file when no active template exists
 * Property 14: Template resolution is cached within a generation session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { AxiosError } from 'axios';

// Mock the skTemplateApi module
vi.mock('@/lib/api', () => ({
  skTemplateApi: {
    getActive: vi.fn(),
  },
}));

import { skTemplateApi } from '@/lib/api';
import { useSkTemplate } from './useSkTemplate';

const mockedGetActive = vi.mocked(skTemplateApi.getActive);

/** Build a real AxiosError so axios.isAxiosError() returns true */
function makeAxiosError(status?: number): AxiosError {
  const err = new AxiosError(
    status ? `Request failed with status code ${status}` : 'Network Error',
    status ? String(status) : 'ERR_NETWORK',
    undefined,
    {},
    status
      ? ({
          status,
          data: {},
          headers: {},
          config: {} as any,
          statusText: '',
        } as any)
      : undefined,
  );
  return err;
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retryDelay: 0,
        gcTime: Infinity,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Property 12: Template resolution uses active uploaded template when available ──

describe('Property 12 – returns file_url when active template exists', () => {
  it('returns templateUrl equal to file_url from the API response', async () => {
    const fileUrl = 'https://storage.example.com/sk-templates/abc123.docx';
    mockedGetActive.mockResolvedValueOnce({ file_url: fileUrl, id: 1, sk_type: 'gty' });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useSkTemplate('gty'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.templateUrl).toBe(fileUrl);
    expect(result.current.error).toBeNull();
    expect(mockedGetActive).toHaveBeenCalledWith('gty');
  });

  it('passes the correct skType to getActive', async () => {
    mockedGetActive.mockResolvedValueOnce({ file_url: 'https://example.com/gtt.docx', id: 2, sk_type: 'gtt' });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useSkTemplate('gtt'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetActive).toHaveBeenCalledWith('gtt');
    expect(result.current.templateUrl).toBe('https://example.com/gtt.docx');
  });
});

// ── Property 13: Template resolution falls back to static file when no active template exists ──

describe('Property 13 – falls back to static path on 404', () => {
  it('returns static fallback URL on 404 response', async () => {
    mockedGetActive.mockRejectedValueOnce(makeAxiosError(404));

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useSkTemplate('gty'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.templateUrl).toBe('/templates/sk-gty-template.docx');
    expect(result.current.error).toBeNull();
  });

  it('builds the fallback path using the provided skType', async () => {
    mockedGetActive.mockRejectedValueOnce(makeAxiosError(404));

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useSkTemplate('kamad'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.templateUrl).toBe('/templates/sk-kamad-template.docx');
    expect(result.current.error).toBeNull();
  });
});

// ── 5xx / network error → sets error, templateUrl is null ──

describe('5xx and network errors set error and return null templateUrl', () => {
  it('sets error message on 500 response', async () => {
    mockedGetActive.mockRejectedValue(makeAxiosError(500));

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useSkTemplate('gty'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.templateUrl).toBeNull();
    expect(result.current.error).toContain('gty');
    expect(result.current.error).toContain('500');
  });

  it('sets error message on network error (no response)', async () => {
    mockedGetActive.mockRejectedValue(makeAxiosError());

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useSkTemplate('tendik'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.templateUrl).toBeNull();
    expect(result.current.error).toContain('tendik');
  });
});

// ── Property 14: Template resolution is cached within a generation session ──

describe('Property 14 – TanStack Query cache prevents duplicate requests for same skType', () => {
  it('calls getActive only once when two hooks share the same skType and QueryClient', async () => {
    const fileUrl = 'https://storage.example.com/sk-templates/gty.docx';
    // Use mockResolvedValue (not Once) so both hooks can resolve from the same mock
    mockedGetActive.mockResolvedValue({ file_url: fileUrl, id: 1, sk_type: 'gty' });

    // Single shared QueryClient simulates a single generation session
    const queryClient = makeQueryClient();
    const wrapper = makeWrapper(queryClient);

    const { result: result1 } = renderHook(() => useSkTemplate('gty'), { wrapper });
    const { result: result2 } = renderHook(() => useSkTemplate('gty'), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    // Both hooks should return the same URL
    expect(result1.current.templateUrl).toBe(fileUrl);
    expect(result2.current.templateUrl).toBe(fileUrl);

    // API should only have been called once due to cache deduplication
    expect(mockedGetActive).toHaveBeenCalledTimes(1);
  });

  it('calls getActive separately for different skTypes', async () => {
    mockedGetActive
      .mockResolvedValueOnce({ file_url: 'https://example.com/gty.docx', id: 1, sk_type: 'gty' })
      .mockResolvedValueOnce({ file_url: 'https://example.com/gtt.docx', id: 2, sk_type: 'gtt' });

    const queryClient = makeQueryClient();
    const wrapper = makeWrapper(queryClient);

    const { result: gtyResult } = renderHook(() => useSkTemplate('gty'), { wrapper });
    const { result: gttResult } = renderHook(() => useSkTemplate('gtt'), { wrapper });

    await waitFor(() => {
      expect(gtyResult.current.isLoading).toBe(false);
      expect(gttResult.current.isLoading).toBe(false);
    });

    expect(gtyResult.current.templateUrl).toBe('https://example.com/gty.docx');
    expect(gttResult.current.templateUrl).toBe('https://example.com/gtt.docx');
    expect(mockedGetActive).toHaveBeenCalledTimes(2);
  });
});
