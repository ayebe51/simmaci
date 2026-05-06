/**
 * API service for WA Blast message templates.
 * Feature: wa-blast
 */

import { apiClient } from '@/lib/api';
import type {
  WaBlastTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
} from '../types/waBlast.types';

/**
 * Fetch all message templates.
 */
export async function getTemplates(): Promise<WaBlastTemplate[]> {
  const { data } = await apiClient.get<WaBlastTemplate[]>('/wa-blast-templates');
  return data;
}

/**
 * Create a new message template.
 */
export async function createTemplate(payload: CreateTemplatePayload): Promise<WaBlastTemplate> {
  const { data } = await apiClient.post<WaBlastTemplate>('/wa-blast-templates', payload);
  return data;
}

/**
 * Fetch a single message template by ID.
 */
export async function getTemplate(id: number): Promise<WaBlastTemplate> {
  const { data } = await apiClient.get<WaBlastTemplate>(`/wa-blast-templates/${id}`);
  return data;
}

/**
 * Update an existing message template.
 */
export async function updateTemplate(
  id: number,
  payload: UpdateTemplatePayload,
): Promise<WaBlastTemplate> {
  const { data } = await apiClient.put<WaBlastTemplate>(`/wa-blast-templates/${id}`, payload);
  return data;
}

/**
 * Delete a message template.
 */
export async function deleteTemplate(id: number): Promise<void> {
  await apiClient.delete(`/wa-blast-templates/${id}`);
}
