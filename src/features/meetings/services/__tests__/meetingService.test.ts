/**
 * meetingService Tests
 * Unit tests for all API call methods in meetingService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { meetingService } from '../meetingService';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockMeeting = {
  id: 1,
  title: 'Rapat Koordinasi',
  agenda: 'Pembahasan program',
  location: 'Aula LP Ma\'arif',
  started_at: '2025-02-15T08:00:00Z',
  ended_at: '2025-02-15T12:00:00Z',
  status: 'upcoming',
  geolocation_enabled: false,
  latitude: null,
  longitude: null,
  geolocation_radius_meters: null,
  qr_umum_url: 'https://example.com/qr-umum',
  schools: [],
  participants: [],
  attendance_stats: { total: 0, present: 0, absent: 0, delegation: 0, walk_in: 0, percentage: 0 },
  minutes: null,
  photos: [],
  invitation_blast_id: null,
  reminder_blast_id: null,
  reminder_scheduled_at: null,
  created_by: 1,
  created_by_name: 'Admin',
  created_at: '2025-02-01T00:00:00Z',
  updated_at: '2025-02-01T00:00:00Z',
};

describe('meetingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── list ──

  describe('list', () => {
    it('should call GET /meetings and return paginated data', async () => {
      const paginatedData = { data: [mockMeeting], current_page: 1, last_page: 1, per_page: 20, total: 1, from: 1, to: 1 };
      // meetingService.list returns response.data.data ?? response.data
      mockApiClient.get.mockResolvedValueOnce({ data: { data: paginatedData } });

      const result = await meetingService.list({ page: 1 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/meetings', { params: { page: 1 } });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(1);
    });

    it('should call GET /meetings without params when none provided', async () => {
      const paginatedData = { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0, from: 0, to: 0 };
      mockApiClient.get.mockResolvedValueOnce({ data: { data: paginatedData } });

      await meetingService.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/meetings', { params: undefined });
    });

    it('should pass filter params to the API', async () => {
      const paginatedData = { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0, from: 0, to: 0 };
      mockApiClient.get.mockResolvedValueOnce({ data: { data: paginatedData } });

      await meetingService.list({ status: 'upcoming', search: 'koordinasi' });

      expect(mockApiClient.get).toHaveBeenCalledWith('/meetings', {
        params: { status: 'upcoming', search: 'koordinasi' },
      });
    });
  });

  // ── getById ──

  describe('getById', () => {
    it('should call GET /meetings/:id and return meeting', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: mockMeeting } });

      const result = await meetingService.getById(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/meetings/1');
      expect(result.id).toBe(1);
      expect(result.title).toBe('Rapat Koordinasi');
    });

    it('should handle response without data wrapper', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: mockMeeting });

      const result = await meetingService.getById(1);

      expect(result.id).toBe(1);
    });
  });

  // ── create ──

  describe('create', () => {
    it('should call POST /meetings with payload', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { data: mockMeeting } });

      const payload = {
        title: 'Rapat Koordinasi',
        location: 'Aula',
        started_at: '2025-02-15T08:00:00Z',
        ended_at: '2025-02-15T12:00:00Z',
        school_ids: [1, 2],
        geolocation_enabled: false,
        participants: [],
        send_invitation_wa: false,
        send_reminder_wa: false,
      };

      const result = await meetingService.create(payload);

      expect(mockApiClient.post).toHaveBeenCalledWith('/meetings', payload);
      expect(result.id).toBe(1);
    });
  });

  // ── update ──

  describe('update', () => {
    it('should call PUT /meetings/:id with partial payload', async () => {
      mockApiClient.put.mockResolvedValueOnce({ data: { data: { ...mockMeeting, title: 'Updated Title' } } });

      const result = await meetingService.update(1, { title: 'Updated Title' });

      expect(mockApiClient.put).toHaveBeenCalledWith('/meetings/1', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should call DELETE /meetings/:id', async () => {
      mockApiClient.delete.mockResolvedValueOnce({ data: { success: true } });

      await meetingService.delete(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/meetings/1');
    });
  });

  // ── participant actions ──

  describe('manualCheckIn', () => {
    it('should call POST /meetings/:id/participants/:pid/check-in', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await meetingService.manualCheckIn(1, 5);

      expect(mockApiClient.post).toHaveBeenCalledWith('/meetings/1/participants/5/check-in');
    });
  });

  describe('resetCheckIn', () => {
    it('should call POST /meetings/:id/participants/:pid/reset-check-in', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await meetingService.resetCheckIn(1, 5);

      expect(mockApiClient.post).toHaveBeenCalledWith('/meetings/1/participants/5/reset-check-in');
    });
  });

  describe('regenerateQr', () => {
    it('should call POST /meetings/:id/participants/:pid/regenerate-qr', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await meetingService.regenerateQr(1, 5);

      expect(mockApiClient.post).toHaveBeenCalledWith('/meetings/1/participants/5/regenerate-qr');
    });
  });

  // ── public check-in ──

  describe('validateCheckInUrl', () => {
    it('should call GET /public/meetings/:id/check-in with query string', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: mockMeeting } });

      const result = await meetingService.validateCheckInUrl('1', 'participant=5&signature=abc');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/public/meetings/1/check-in?participant=5&signature=abc',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: undefined }) })
      );
      expect(result.id).toBe(1);
    });
  });

  describe('walkIn', () => {
    it('should call POST /public/meetings/:id/walk-in with walk-in payload', async () => {
      const mockResponse = {
        success: true,
        message: 'Check-in berhasil',
        data: { attendance_id: 10, participant_name: 'Budi', checked_in_at: '2025-02-15T09:00:00Z', device_info: null, is_delegation: false },
      };
      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const payload = {
        walk_in_name: 'Budi Santoso',
        walk_in_jabatan: 'Guru',
        walk_in_instansi: 'MI Maarif 01',
        walk_in_phone: '081234567890',
      };

      const result = await meetingService.walkIn('1', 'signature=abc', payload);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/public/meetings/1/walk-in?signature=abc',
        payload,
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: undefined }) })
      );
      expect(result.success).toBe(true);
    });
  });

  // ── reports ──

  describe('downloadPdf', () => {
    it('should call GET /meetings/:id/report/pdf with blob responseType', async () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      mockApiClient.get.mockResolvedValueOnce({ data: mockBlob });

      const result = await meetingService.downloadPdf(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/meetings/1/report/pdf', { responseType: 'blob' });
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('downloadExcel', () => {
    it('should call GET /meetings/:id/report/excel with blob responseType', async () => {
      const mockBlob = new Blob(['excel content'], { type: 'application/vnd.ms-excel' });
      mockApiClient.get.mockResolvedValueOnce({ data: mockBlob });

      const result = await meetingService.downloadExcel(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/meetings/1/report/excel', { responseType: 'blob' });
      expect(result).toBeInstanceOf(Blob);
    });
  });

  // ── getFileUrl ──

  describe('getFileUrl', () => {
    it('should construct storage URL from path', () => {
      const url = meetingService.getFileUrl('meetings/1/photos/photo.jpg');
      expect(url).toContain('/storage/meetings/1/photos/photo.jpg');
    });
  });
});
