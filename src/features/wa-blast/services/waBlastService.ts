/**
 * API service for WA Blast sessions.
 * Feature: wa-blast
 */

import { apiClient } from '@/lib/api';
import type {
  WaBlast,
  WaBlastRecipient,
  BlastProgress,
  BlastListParams,
  CreateBlastPayload,
  PreviewRecipientsPayload,
  PreviewRecipientsResponse,
  PaginatedResponse,
} from '../types/waBlast.types';

/**
 * Fetch paginated list of blast sessions with optional filters.
 */
export async function getBlasts(
  params?: BlastListParams,
): Promise<PaginatedResponse<WaBlast>> {
  const { data } = await apiClient.get<PaginatedResponse<WaBlast>>('/wa-blasts', { params });
  return data;
}

/**
 * Create a new blast session. Supports multipart/form-data when an attachment is provided.
 */
export async function createBlast(payload: CreateBlastPayload): Promise<WaBlast> {
  if (payload.attachment) {
    // Use FormData for file upload
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('recipient_category', payload.recipient_category);
    formData.append('message_body', payload.message_body);

    if (payload.jenjang) {
      payload.jenjang.forEach((j) => formData.append('jenjang[]', j));
    }
    if (payload.school_ids) {
      payload.school_ids.forEach((id) => formData.append('school_ids[]', String(id)));
    }
    if (payload.scheduled_at) {
      formData.append('scheduled_at', payload.scheduled_at);
    }
    if (payload.excluded_phone_numbers) {
      payload.excluded_phone_numbers.forEach((p) =>
        formData.append('excluded_phone_numbers[]', p),
      );
    }
    formData.append('attachment', payload.attachment);

    const { data } = await apiClient.post<WaBlast>('/wa-blasts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return data;
  }

  // JSON request when no attachment
  const { data } = await apiClient.post<WaBlast>('/wa-blasts', payload);
  return data;
}

/**
 * Fetch detail of a single blast session including its recipients.
 */
export async function getBlast(id: number): Promise<WaBlast & { recipients: WaBlastRecipient[] }> {
  const { data } = await apiClient.get<WaBlast & { recipients: WaBlastRecipient[] }>(
    `/wa-blasts/${id}`,
  );
  return data;
}

/**
 * Cancel a blast session (only allowed for status: scheduled or draft).
 */
export async function deleteBlast(id: number): Promise<void> {
  await apiClient.delete(`/wa-blasts/${id}`);
}

/**
 * Preview the compiled recipient list before creating a blast.
 */
export async function previewRecipients(
  payload: PreviewRecipientsPayload,
): Promise<PreviewRecipientsResponse> {
  const { data } = await apiClient.post<PreviewRecipientsResponse>(
    '/wa-blasts/preview-recipients',
    payload,
  );
  return data;
}

/**
 * Create a retry blast from the failed recipients of an existing blast.
 */
export async function retryBlast(id: number): Promise<WaBlast> {
  const { data } = await apiClient.post<WaBlast>(`/wa-blasts/${id}/retry`);
  return data;
}

/**
 * Fetch real-time delivery progress for a blast session.
 */
export async function getBlastProgress(id: number): Promise<BlastProgress> {
  const { data } = await apiClient.get<BlastProgress>(`/wa-blasts/${id}/progress`);
  return data;
}
