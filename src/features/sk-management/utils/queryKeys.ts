/**
 * Standardized query keys for SK management feature.
 * Enables targeted cache invalidation and consistent key usage across components.
 */

export interface SkFilters {
  status?: string;
  jenis_sk?: string;
  search?: string;
  school_id?: number;
  page?: number;
  per_page?: number;
}

export const SK_QUERY_KEYS = {
  all: ['sk-documents'] as const,
  list: (filters: SkFilters) => ['sk-documents', 'list', filters] as const,
  detail: (id: number) => ['sk-documents', 'detail', id] as const,
  candidates: (search: string, page: number) =>
    ['sk-candidates-generator', search, page] as const,
  templates: ['sk-templates'] as const,
  revisions: ['sk-revisions'] as const,
  pending: ['sk-pending'] as const,
};
