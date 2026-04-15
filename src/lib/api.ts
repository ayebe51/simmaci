import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Central API client for SIM Maarif — replaces all Convex hooks with REST API calls.
 *
 * Usage:
 *   import { apiClient } from '@/lib/api';
 *   const { data } = await apiClient.get('/teachers', { params: { search: 'Ahmad' } });
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const API_BASE_URL = API_URL;
export const API_STORAGE_URL = API_BASE_URL.replace('/api', '/storage');

export const getFileUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // If it starts with storage/, remove it as the base URL already includes it (usually)
  // or handle based on backend behavior. 
  // For Laravel, it's usually http://domain/storage/path
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${API_BASE_URL.replace('/api', '')}/${cleanPath}`;
};

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// ── Axios Instance ──

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// ── Request Interceptor: Attach Sanctum token ──

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor: Handle 401 ──

apiClient.interceptors.response.use(
  (response) => {
    // If the response follows Requirement 6 (Standardized API Response)
    // and it was successful, we extract the nested 'data' field.
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      return {
        ...response,
        data: response.data.data
      };
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth helpers ──

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },

  async register(payload: { email: string; name: string; password: string; role?: string; unit?: string }) {
    const { data } = await apiClient.post('/auth/register', payload);
    return data;
  },

  async getUser() {
    const { data } = await apiClient.get('/auth/user');
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    return data;
  },

  async changePassword(oldPassword: string, newPassword: string) {
    const { data } = await apiClient.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return data;
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

// ── Dashboard API ──

export const dashboardApi = {
  getStats: () => apiClient.get('/dashboard/stats').then((r) => r.data),
  getSchoolStats: () => apiClient.get('/dashboard/school-stats').then((r) => r.data),
  getCharts: () => apiClient.get('/dashboard/charts').then((r) => r.data),
  getSkStatistics: (unitKerja?: string) =>
    apiClient.get('/dashboard/sk-statistics', { params: { unit_kerja: unitKerja } }).then((r) => r.data),
  getSkTrend: (months: number = 6, unitKerja?: string) =>
    apiClient.get('/dashboard/sk-trend', { params: { months, unit_kerja: unitKerja } }).then((r) => r.data),
  getSchoolBreakdown: () => apiClient.get('/dashboard/school-breakdown').then((r) => r.data),
};

// ── Teachers API ──

export const teacherApi = {
  list: (params?: Record<string, any>) => apiClient.get('/teachers', { params }).then((r) => r.data),
  get: (id: number) => apiClient.get(`/teachers/${id}`).then((r) => r.data),
  create: (data: any) => apiClient.post('/teachers', data).then((r) => r.data),
  update: (id: number, data: any) => apiClient.put(`/teachers/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/teachers/${id}`).then((r) => r.data),
  import: (teachers: any[]) => apiClient.post('/teachers/import', { teachers }, { timeout: 120000 }).then((r) => r.data),
  deleteAll: () => apiClient.delete('/teachers/delete-all').then((r) => r.data),
  generateAccounts: (teacherIds?: number[]) =>
    apiClient.post('/teachers/generate-accounts', { teacher_ids: teacherIds }).then((r) => r.data),
  export: (params?: Record<string, any>) =>
    apiClient.get('/teachers/export', { params, responseType: 'blob' }).then((r) => r.data),
};


// ── Students API ──

export const studentApi = {
  list: (params?: Record<string, any>) => apiClient.get('/students', { params }).then((r) => r.data),
  get: (id: number) => apiClient.get(`/students/${id}`).then((r) => r.data),
  create: (data: any) => apiClient.post('/students', data).then((r) => r.data),
  update: (id: number, data: any) => apiClient.put(`/students/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/students/${id}`).then((r) => r.data),
  import: (students: any[]) => apiClient.post('/students/import', { students }, { timeout: 120000 }).then((r) => r.data),
  batchTransition: (payload: { school_id: number; action: 'promote' | 'graduate' }) =>
    apiClient.post('/students/batch-transition', payload).then((r) => r.data),
};

// ── Schools API ──

export const schoolApi = {
  list: (params?: Record<string, any>) => apiClient.get('/schools', { params }).then((r) => r.data),
  get: (id: number) => apiClient.get(`/schools/${id}`).then((r) => r.data),
  create: (data: any) => apiClient.post('/schools', data).then((r) => r.data),
  update: (id: number, data: any) => apiClient.put(`/schools/${id}`, data, { timeout: 60000 }).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/schools/${id}`).then((r) => r.data),
  profile: () => apiClient.get('/schools/profile/me').then((r) => r.data),
  import: (schools: any[]) => apiClient.post('/schools/import', { schools }).then((r) => r.data),
  deleteAll: () => apiClient.delete('/schools/delete-all').then((r) => r.data),
  generateAccounts: (schoolId?: number) => apiClient.post('/schools/generate-accounts', schoolId ? { school_id: schoolId } : {}).then((r) => r.data),
};


// ── SK Documents API ──

export const skApi = {
  list: (params?: Record<string, any>) => apiClient.get('/sk-documents', { params }).then((r) => r.data),
  get: (id: number) => apiClient.get(`/sk-documents/${id}`).then((r) => r.data),
  create: (data: any) => apiClient.post('/sk-documents', data).then((r) => r.data),
  update: (id: number, data: any) => apiClient.put(`/sk-documents/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/sk-documents/${id}`).then((r) => r.data),
  bulkCreate: (documents: any[]) => apiClient.post('/sk-documents/bulk', { documents }).then((r) => r.data),
  submitRequest: (data: any) => apiClient.post('/sk-documents/submit-request', data).then((r) => r.data),
  bulkRequest: (data: { documents: any[]; surat_permohonan_url: string }) =>
    apiClient.post('/sk-documents/bulk-request', data).then((r) => r.data),
  batchUpdateStatus: (ids: number[], status: string, rejectionReason?: string) =>
    apiClient.patch('/sk-documents/batch-status', { ids, status, rejection_reason: rejectionReason }).then((r) => r.data),
  getRevisions: () => apiClient.get('/sk-documents-revisions').then((r) => r.data),
  countByStatus: (params?: Record<string, any>) =>
    apiClient.get('/sk-documents-count', { params }).then((r) => r.data),
};

// ── Users API ──

export const userApi = {
  list: (params?: Record<string, any>) => apiClient.get('/users', { params }).then((r) => r.data),
  get: (id: number) => apiClient.get(`/users/${id}`).then((r) => r.data),
  update: (id: number, data: any) => apiClient.put(`/users/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/users/${id}`).then((r) => r.data),
};

// ── Notifications API ──

export const notificationApi = {
  list: () => apiClient.get('/notifications').then((r) => r.data),
  unreadCount: () => apiClient.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id: number) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.patch('/notifications/mark-all-read').then((r) => r.data),
};

// ── Settings API ──

export const settingApi = {
  list: () => apiClient.get('/settings').then((r) => r.data),
  get: (key: string) => apiClient.get(`/settings/${key}`).then((r) => r.data),
  /** update({ key, value }) OR update(key, value, schoolId) */
  update: (keyOrObj: string | { key: string; value: string; school_id?: number | null }, value?: string, schoolId?: number) => {
    const payload = typeof keyOrObj === 'object'
      ? keyOrObj
      : { key: keyOrObj, value: value ?? '', school_id: schoolId }
    return apiClient.post('/settings', payload).then((r) => r.data)
  },
};

// ── Media API ──

export const mediaApi = {
  upload: (file: File | FormData, folder: string = 'general') => {
    const formData = file instanceof FormData ? file : (() => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      return fd
    })()
    return apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
  delete: (path: string) => apiClient.delete('/files', { data: { path } }).then((r) => r.data),
};


// ── Attendance API ──

export const attendanceApi = {
  teacherIndex: (params?: Record<string, any>) => apiClient.get('/attendance/teacher', { params }).then((r) => r.data),
  teacherStore: (data: any) => apiClient.post('/attendance/teacher', data).then((r) => r.data),
  studentLogIndex: (params?: Record<string, any>) => apiClient.get('/attendance/student-logs', { params }).then((r) => r.data),
  studentLogStore: (data: any) => apiClient.post('/attendance/student-logs', data).then((r) => r.data),
  qrScan: (qrCode: string) => apiClient.post('/attendance/qr-scan', { qr_code: qrCode }).then((r) => r.data),
  studentReport: (params?: Record<string, any>) => apiClient.get('/attendance/student-report', { params }).then((r) => r.data),
  settingsShow: () => apiClient.get('/attendance/settings').then((r) => r.data),
  settingsUpdate: (data: any) => apiClient.post('/attendance/settings', data).then((r) => r.data),
  checkWaConnection: () => apiClient.post('/attendance/check-wa').then((r) => r.data),
  
  // Master Attendance Data
  subjectList: () => apiClient.get('/subjects').then((r) => r.data),
  subjectStore: (data: any) => apiClient.post('/subjects', data).then((r) => r.data),
  subjectUpdate: (id: number, data: any) => apiClient.put(`/subjects/${id}`, data).then((r) => r.data),
  
  classList: () => apiClient.get('/classes').then((r) => r.data),
  classStore: (data: any) => apiClient.post('/classes', data).then((r) => r.data),
  classUpdate: (id: number, data: any) => apiClient.put(`/classes/${id}`, data).then((r) => r.data),
  
  scheduleList: (params?: Record<string, any>) => apiClient.get('/lesson-schedules', { params }).then((r) => r.data),
  scheduleStore: (data: any) => apiClient.post('/lesson-schedules', data).then((r) => r.data),
};

// ── Headmasters API ──

export const headmasterApi = {
  list: (params?: Record<string, any>) => apiClient.get('/headmasters', { params }).then((r) => r.data),
  get: (id: number) => apiClient.get(`/headmasters/${id}`).then((r) => r.data),
  expiring: () => apiClient.get('/headmasters-expiring').then((r) => r.data),
};

// ── Verification API ──

export const verificationApi = {
  verifyByCode: (code: string) => apiClient.get(`/verify/sk/${code}`).then((r) => r.data),
  verifyByNuptk: (nuptk: string) => apiClient.get(`/verify/teacher/${nuptk}`).then((r) => r.data),
  verifyByNisn: (nisn: string) => apiClient.get(`/verify/student/${nisn}`).then((r) => r.data),
};

// ── NUPTK Submissions API ──

export const nuptkApi = {
  list: (params?: Record<string, any>) => apiClient.get('/nuptk-submissions', { params }).then((r) => r.data),
  store: (data: any) => apiClient.post('/nuptk-submissions', data).then((r) => r.data),
  approve: (id: number, data: { nomor_surat_rekomendasi: string, tanggal_surat_rekomendasi: string }) =>
    apiClient.post(`/nuptk-submissions/${id}/approve`, data).then((r) => r.data),
  reject: (id: number, data: { rejection_reason: string }) =>
    apiClient.post(`/nuptk-submissions/${id}/reject`, data).then((r) => r.data),
};

// ── Mutations API ──

export const mutationApi = {
  list: (params?: Record<string, any>) => apiClient.get('/teacher-mutations', { params }).then((r) => r.data),
  move: (data: { teacher_id: number; to_school_id: number; sk_number: string; reason?: string; effective_date: string }) =>
    apiClient.post('/teacher-mutations', data).then((r) => r.data),
};

// ── Audit API ──

export const auditApi = {
  healthCheck: () => apiClient.get('/data-audit').then((r) => r.data),
};

export const approvalApi = {
  getHistory: (documentId: string, documentType?: string) =>
    apiClient.get('/approval-history', { params: { document_id: documentId, document_type: documentType } }).then((r) => r.data),
};

export const eventApi = {
  list: () => apiClient.get('/events').then((r) => r.data),
  get: (id: number) => apiClient.get(`/events/${id}`).then((r) => r.data),
  create: (data: any) => apiClient.post('/events', data).then((r) => r.data),
  update: (id: number, data: any) => apiClient.put(`/events/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/events/${id}`).then((r) => r.data),
  importCompetitionResults: (competitionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/events/competitions/${competitionId}/results/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

// ── Reports API ──

export const reportApi = {
  teacherRekap: {
    list: (params?: Record<string, any>) => apiClient.get('/reports/teachers', { params }).then((r) => r.data),
  },
  skReport: {
    list: (params?: Record<string, any>) => apiClient.get('/reports/sk', { params }).then((r) => r.data),
  },
  summary: () => apiClient.get('/reports/summary').then((r) => r.data),
};
