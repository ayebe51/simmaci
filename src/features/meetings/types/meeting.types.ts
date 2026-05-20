/**
 * Meeting Attendance QR System Types
 * Comprehensive TypeScript interfaces for meeting management, attendance tracking, and reporting
 */

// ── Enums ──

export type MeetingStatus = 'upcoming' | 'ongoing' | 'completed';
export type ParticipantType = 'teacher' | 'headmaster' | 'external';
export type AttendanceType = 'qr_personal' | 'qr_umum' | 'manual';
export type AttendanceStatus = 'present' | 'present_delegation' | 'present_walkin' | 'absent';
export type ReminderTiming = 'H-1' | '2_hours' | 'custom';

// ── Device Info ──

export interface DeviceInfo {
  user_agent: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
}

// ── Statistics ──

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  delegation: number;
  walk_in: number;
  percentage: number;
}

// ── School ──

export interface School {
  id: number;
  nama: string;
  jenjang?: string;
  npsn?: string;
  alamat?: string;
}

// ── Meeting Attendance ──

export interface MeetingAttendance {
  id: number;
  meeting_id: number;
  participant_id: number | null;
  attendance_type: AttendanceType;
  is_delegation: boolean;
  delegated_for_participant_id: number | null;
  delegated_for_name: string | null;
  delegation_letter_path: string | null;
  walk_in_name: string | null;
  walk_in_jabatan: string | null;
  walk_in_instansi: string | null;
  walk_in_phone: string | null;
  checked_in_at: string; // ISO 8601 with microseconds
  checked_in_by_admin_id: number | null;
  checked_in_by_admin_name: string | null;
  device_info: DeviceInfo | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

// ── Meeting Participant ──

export interface MeetingParticipant {
  id: number;
  meeting_id: number;
  participant_type: ParticipantType;
  participant_id: number | null;
  name: string;
  jabatan: string;
  instansi: string;
  phone_number: string;
  qr_personal_url: string; // full signed URL for QR code display
  is_token_used: boolean;
  token_used_at: string | null;
  token_revoked: boolean;
  attendance: MeetingAttendance | null;
  attendance_status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

// ── Meeting Minutes ──

export interface MeetingMinutes {
  id: number;
  meeting_id: number;
  content: string; // HTML content from rich text editor
  created_by: number;
  created_by_name: string;
  updated_by: number | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// ── Meeting Photo ──

export interface MeetingPhoto {
  id: number;
  meeting_id: number;
  file_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
}

// ── Meeting ──

export interface Meeting {
  id: number;
  title: string;
  agenda: string | null;
  location: string;
  started_at: string; // ISO 8601
  ended_at: string;
  status: MeetingStatus;
  geolocation_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  geolocation_radius_meters: number | null;
  qr_umum_url: string; // full signed URL for QR_Umum
  schools: School[];
  participants: MeetingParticipant[];
  attendance_stats: AttendanceStats;
  minutes: MeetingMinutes | null;
  photos: MeetingPhoto[];
  invitation_blast_id: number | null;
  reminder_blast_id: number | null;
  reminder_scheduled_at: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

// ── Request Payloads ──

export interface ParticipantInput {
  participant_type: ParticipantType;
  participant_id: number | null;
  name: string;
  jabatan: string;
  instansi: string;
  phone_number: string;
}

export interface CreateMeetingPayload {
  title: string;
  agenda?: string;
  location: string;
  started_at: string;
  ended_at: string;
  school_ids: number[];
  geolocation_enabled: boolean;
  latitude?: number;
  longitude?: number;
  geolocation_radius_meters?: number;
  participants: ParticipantInput[];
  send_invitation_wa: boolean;
  send_reminder_wa: boolean;
  reminder_timing?: ReminderTiming;
  reminder_custom_at?: string; // ISO 8601 with timezone offset, for custom timing
  invitation_attachment_path?: string; // Storage path of PDF to attach to WA invitation
}

export interface UpdateMeetingPayload extends Partial<CreateMeetingPayload> {
  id: number;
}

export interface CheckInPayload {
  is_delegation: boolean;
  delegated_for_participant_id?: number;
  delegation_letter?: File;
  latitude?: number;
  longitude?: number;
}

export interface WalkInPayload {
  walk_in_name: string;
  walk_in_jabatan: string;
  walk_in_instansi: string;
  walk_in_phone: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateMinutesPayload {
  meeting_id: number;
  content: string;
}

export interface UpdateMinutesPayload {
  content: string;
}

export interface UploadPhotosPayload {
  meeting_id: number;
  files: File[];
  captions?: string[];
}

// ── Query Parameters ──

export interface MeetingListParams {
  date_from?: string;
  date_to?: string;
  status?: MeetingStatus;
  school_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

// ── API Response ──

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ── Check-In Response ──

export interface CheckInResponse {
  success: boolean;
  message: string;
  data: {
    attendance_id: number;
    participant_name: string;
    checked_in_at: string;
    device_info: DeviceInfo;
    is_delegation: boolean;
    delegated_for_name?: string;
  };
}

// ── Report Data ──

export interface ReportData {
  meeting: Meeting;
  attendances: MeetingAttendance[];
  stats: AttendanceStats;
  generated_at: string;
  generated_by: string;
}
