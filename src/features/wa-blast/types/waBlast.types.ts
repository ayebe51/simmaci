/**
 * TypeScript types for the WA Blast feature.
 * Feature: wa-blast
 */

// ── Enums ──

export type BlastStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'invalid_number';

export type RecipientCategory = 'kepala_sekolah' | 'gtk' | 'both';

export type RecipientType = 'kepala_sekolah' | 'gtk';

export type Jenjang = 'MI' | 'MTs' | 'MA';

// ── Core Interfaces ──

export interface WaBlast {
  id: number;
  title: string;
  recipient_category: RecipientCategory;
  /** JSON array of school IDs; null = all schools */
  school_ids: number[] | null;
  /** JSON array of jenjang filter; null = all jenjang */
  jenjang_filter: Jenjang[] | null;
  message_body: string;
  /** Path to PDF attachment in Laravel Storage */
  attachment_path: string | null;
  attachment_name: string | null;
  blast_status: BlastStatus;
  /** ISO 8601 datetime; null = send immediately */
  scheduled_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  invalid_count: number;
  /** Reference to the original blast if this is a retry */
  parent_blast_id: number | null;
  created_by: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaBlastRecipient {
  id: number;
  wa_blast_id: number;
  recipient_name: string;
  school_name: string;
  /** Normalized phone number in format 62xxxxxxxxx */
  phone_number: string;
  recipient_type: RecipientType;
  delivery_status: DeliveryStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaBlastTemplate {
  id: number;
  name: string;
  body: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface WaBlastConfig {
  id: number;
  api_url: string;
  /** Token is masked as '***' when returned from the API */
  api_token: string;
  sender_number: string;
  max_recipients_per_session: number;
  max_daily_messages: number;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecipientPreview {
  recipient_name: string;
  school_name: string;
  phone_number: string;
  recipient_type: RecipientType;
  /** Whether the phone number passes validation */
  is_valid: boolean;
}

// ── Blast Progress ──

export interface BlastProgress {
  blast_status: BlastStatus;
  total_count: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  invalid_count: number;
}

// ── Request Payloads ──

export interface CreateBlastPayload {
  title: string;
  recipient_category: RecipientCategory;
  jenjang?: Jenjang[];
  school_ids?: number[];
  message_body: string;
  attachment?: File;
  scheduled_at?: string | null;
  excluded_phone_numbers?: string[];
}

export interface PreviewRecipientsPayload {
  recipient_category: RecipientCategory;
  jenjang?: Jenjang[];
  school_ids?: number[];
}

export interface PreviewRecipientsResponse {
  recipients: RecipientPreview[];
  valid_count: number;
  invalid_count: number;
  total_count: number;
}

export interface CreateTemplatePayload {
  name: string;
  body: string;
}

export interface UpdateTemplatePayload {
  name: string;
  body: string;
}

export interface SaveConfigPayload {
  api_url: string;
  api_token: string;
  sender_number: string;
  max_recipients_per_session: number;
  max_daily_messages: number;
}

// ── List / Pagination ──

export interface BlastListParams {
  status?: BlastStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
