/**
 * TanStack Query mutation hook for previewing WA Blast recipients.
 * Feature: wa-blast
 */

import { useMutation } from '@tanstack/react-query';
import { previewRecipients } from '../services/waBlastService';
import type {
  PreviewRecipientsPayload,
  PreviewRecipientsResponse,
} from '../types/waBlast.types';

/**
 * Preview the compiled recipient list before creating a blast.
 * This is a mutation because it's a POST request that compiles data on-demand.
 */
export function useRecipientPreview() {
  return useMutation<PreviewRecipientsResponse, Error, PreviewRecipientsPayload>({
    mutationFn: previewRecipients,
  });
}
