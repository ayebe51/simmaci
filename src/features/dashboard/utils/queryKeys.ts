/**
 * Standardized query keys for dashboard feature.
 * Enables targeted cache invalidation and consistent key usage across components.
 */

export const DASHBOARD_QUERY_KEYS = {
  stats: ['dashboard', 'stats'] as const,
  schoolStats: ['dashboard', 'school-stats'] as const,
  charts: ['dashboard', 'charts'] as const,
};
