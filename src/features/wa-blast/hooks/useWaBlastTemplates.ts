/**
 * TanStack Query hooks for WA Blast message templates.
 * Feature: wa-blast
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from '../services/waBlastTemplateService';
import type {
  WaBlastTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
} from '../types/waBlast.types';

export const WA_BLAST_TEMPLATES_QUERY_KEY = 'wa-blast-templates';
export const WA_BLAST_TEMPLATE_DETAIL_QUERY_KEY = 'wa-blast-template-detail';

/**
 * Fetch all message templates.
 */
export function useWaBlastTemplates() {
  return useQuery<WaBlastTemplate[]>({
    queryKey: [WA_BLAST_TEMPLATES_QUERY_KEY],
    queryFn: getTemplates,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Fetch a single message template by ID.
 */
export function useWaBlastTemplate(id: number) {
  return useQuery<WaBlastTemplate>({
    queryKey: [WA_BLAST_TEMPLATE_DETAIL_QUERY_KEY, id],
    queryFn: () => getTemplate(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * Create a new message template.
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation<WaBlastTemplate, Error, CreateTemplatePayload>({
    mutationFn: createTemplate,
    onSuccess: () => {
      // Invalidate templates list to refetch
      queryClient.invalidateQueries({ queryKey: [WA_BLAST_TEMPLATES_QUERY_KEY] });
    },
  });
}

/**
 * Update an existing message template.
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation<WaBlastTemplate, Error, { id: number; payload: UpdateTemplatePayload }>({
    mutationFn: ({ id, payload }) => updateTemplate(id, payload),
    onSuccess: (_, variables) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: [WA_BLAST_TEMPLATES_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [WA_BLAST_TEMPLATE_DETAIL_QUERY_KEY, variables.id],
      });
    },
  });
}

/**
 * Delete a message template.
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      // Invalidate templates list to refetch
      queryClient.invalidateQueries({ queryKey: [WA_BLAST_TEMPLATES_QUERY_KEY] });
    },
  });
}
