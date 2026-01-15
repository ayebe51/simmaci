import axios from "axios";

// API URL from environment variable, fallback to localhost for development
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Axios Instance with Extended Timeout for Bulk Uploads
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor for Token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor for 401 (Unauthorized)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("401 Unauthorized detected. Logging out...");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Prevent infinite redirect loop if already on login
      if (!window.location.pathname.includes('/login')) {
         window.location.href = '/login'; 
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Helpers
  getToken: () => localStorage.getItem("token"),
  setToken: (token: string) => localStorage.setItem("token", token),
  clearToken: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  // Auth
  login: async (username: string, password: string) => {
    try {
        const res = await axiosInstance.post("/auth/login", { username, password });
        return res.data;
    } catch (e: any) {
        throw new Error(e.response?.data?.message || "Login failed");
    }
  },

  register: async (data: any) => {
    try {
        const res = await axiosInstance.post("/auth/register", data);
        return res.data;
    } catch (e: any) {
        throw new Error(e.response?.data?.message || "Registration failed");
    }
  },

  // HEADMASTER API
  createHeadmasterTenure: async (data: any) => {
    const res = await api.post("/headmaster", data)
    return res.data
  },
  getHeadmasterTenures: async () => {
    const res = await api.get("/headmaster")
    return res.data
  },
  verifyHeadmaster: async (id: string) => {
    const res = await axiosInstance.patch(`/headmaster/${id}/verify`, {}) // Use axiosInstance for patch
    return res.data
  },
  approveHeadmaster: async (id: string, signatureUrl?: string, skUrl?: string) => {
    const res = await axiosInstance.patch(`/headmaster/${id}/approve`, { signatureUrl, skUrl }) // Use axiosInstance for patch
    return res.data
  },
  rejectHeadmaster: async (id: string, reason: string) => {
    const res = await axiosInstance.patch(`/headmaster/${id}/reject`, { reason }) // Use axiosInstance for patch
    return res.data
  },
  downloadSkHeadmaster: async (id: string) => {
    const res = await axiosInstance.get(`/headmaster/${id}/pdf`, { responseType: 'blob' })
    return res.data
  },

  // Generic Helpers (Axios Wrappers)
  get: async (endpoint: string, options: any = {}) => {
      try {
          const res = await axiosInstance.get(endpoint, {
             ...options,
             params: options.params 
          });
          return { data: res.data };
      } catch (e: any) {
          console.error(`GET ${endpoint} failed`, e);
          throw e; // Axios throws nicely formatted errors usually
      }
  },

  post: async (endpoint: string, data: any, options: any = {}) => {
      try {
          const res = await axiosInstance.post(endpoint, data, options);
          return { data: res.data };
      } catch (e: any) {
          console.error(`POST ${endpoint} failed`, e);
          throw e;
      }
  },

  put: async (endpoint: string, data: any, options: any = {}) => {
      try {
          const res = await axiosInstance.put(endpoint, data, options);
          return { data: res.data };
      } catch (e: any) {
          console.error(`PUT ${endpoint} failed`, e);
          throw e;
      }
  },

  // Master Data
  getSchools: async () => {
    const res = await api.get("/master-data/schools")
    return res.data
  },

  getSchool: async (id: string) => {
    const res = await api.get(`/master-data/schools/${id}`)
    return res.data
  },

  getSchoolTeachers: async (id: string) => {
    const res = await api.get(`/master-data/schools/${id}/teachers`)
    return res.data
  },

  createSchool: async (data: any) => {
    const res = await api.post("/master-data/schools", data)
    return res.data
  },
  updateSchool: async (id: string, data: any) => {
    const res = await api.put(`/master-data/schools/${id}`, data)
    return res.data
  },
  getTeachers: async (unitKerja?: string, kecamatan?: string, isCertified?: string) => {
    const params: any = {}
    if (unitKerja) params.unitKerja = unitKerja;
    if (kecamatan) params.kecamatan = kecamatan;
    if (isCertified && isCertified !== "all") params.isCertified = isCertified;
    
    const res = await api.get("/master-data/teachers", { params })
    console.log("DEBUG: api.getTeachers response:", res.data); // Temporary Debug
    return res.data
  },
  exportTeachers: async (unitKerja?: string, kecamatan?: string, isCertified?: string) => {
    const params: any = {}
    if (unitKerja) params.unitKerja = unitKerja;
    if (kecamatan) params.kecamatan = kecamatan;
    if (isCertified && isCertified !== "all") params.isCertified = isCertified;
    const res = await axiosInstance.get("/master-data/teachers/export", { params, responseType: 'blob' })
    return res.data;
  },
  updateTeacher: async (id: string, data: any) => {
    const res = await api.put(`/master-data/teachers/${id}`, data)
    return res.data
  },
  createTeacher: async (data: any) => {
    const res = await api.post("/master-data/teachers", data)
    return res.data
  },
  upsertTeachers: async (data: any[]) => {
    const res = await api.post("/master-data/teachers/upsert", data)
    return res.data
  },
  
  delete: async (endpoint: string, options: any = {}) => {
      try {
          const res = await axiosInstance.delete(endpoint, options);
          return { data: res.data };
      } catch (e: any) {
          console.error(`DELETE ${endpoint} failed`, e);
          throw e;
      }
  },

  deleteTeacher: async (id: string) => {
    const res = await api.delete(`/master-data/teachers/${id}`)
    return res.data
  },
  deleteAllTeachers: async () => {
    const res = await api.delete("/master-data/teachers")
    return res.data 
  },
  getStudents: async (schoolId?: string) => {
    const params = schoolId ? { schoolId } : {}
    const res = await api.get("/master-data/students", { params })
    return res.data
  },
  createStudent: async (data: any) => {
    const res = await api.post("/master-data/students", data)
    return res.data
  },
  uploadFile: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      // Axios automatically sets Content-Type to multipart/form-data with boundary when data is FormData
      // We must override the default application/json
      const res = await api.post("/master-data/upload", formData, {
        headers: { "Content-Type": undefined }
      })
      return res.data
  },
  importSchools: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const res = await api.post("/master-data/schools/import", formData, {
        headers: { "Content-Type": undefined }
      })
      return res.data
  },
  importTeachers: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const res = await api.post("/master-data/teachers/import", formData, {
        headers: { "Content-Type": undefined }
      })
      return res.data
  },
  downloadTeacherTemplate: async () => {
      const res = await axiosInstance.get("/master-data/teachers/template", { 
        responseType: 'blob' 
      })
      return res.data;
  },
  
  // Student Excel Functions
  exportStudents: async (schoolId?: string) => {
    const params = schoolId ? { schoolId } : {}
    const res = await axiosInstance.get("/master-data/students/export", { params, responseType: 'blob' })
    return res.data;
  },
  downloadStudentTemplate: async () => {
      const res = await axiosInstance.get("/master-data/students/template", { 
        responseType: 'blob' 
      })
      return res.data;
  },
  importStudents: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const res = await axiosInstance.post("/master-data/students/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      return res.data
  },
  
  // Competition Results Import
  importCompetitionResults: async (competitionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/competitions/${competitionId}/results/import`, formData, {
        headers: { "Content-Type": undefined }
    });
    return res.data;
  },

  // SK / Letters
  getSkList: async () => {
    // api.get returns { data: ... } but we want the actual payload which IS the data array
    // Wait, get wrapper: return { data: res.data }.
    // So const { data } = await api.get(...) -> data is the payload.
    // My previous thought was api.get returns {data: payload}.
    // So accessing .data gives payload.
    const res = await api.get("/sk")
    return res.data
  },

  // Users
  getUsers: async () => {
    const res = await api.get("/users")
    return res.data
  },

  // SK
  deleteAllSk: async () => {
    // Uses api.post which uses axiosInstance with auto-token
    const res = await api.post("/sk/delete-all", {});
    return res.data;
  },
  createSk: async (data: any) => {
      const res = await api.post("/sk", data)
      return res.data
  },
  getSk: async () => {
    const res = await api.get("/sk")
    return res.data
  },
  getSkDetail: async (id: string) => {
    const res = await api.get(`/sk/${id}`)
    return res.data
  },
  updateSkStatus: async (id: string, status: string) => {
    const res = await api.put(`/sk/${id}`, { status });
    return res.data;
  },

  // Events
  getEvents: async () => {
    const res = await api.get("/events");
    return res.data;
  },
  createEvent: async (data: any) => {
    const res = await api.post("/events", data);
    return res.data;
  },
  deleteEvent: async (id: string) => {
    const res = await api.delete(`/events/${id}`);
    return res.data;
  },

  // Dashboard
  getDashboardStats: async () => {
    const res = await api.get("/dashboard/stats")
    return res.data
  },

  // AI Assistant
  ai: {
    query: async (data: { question: string }) => {
      const res = await axiosInstance.post('/ai/query', data);
      return res.data;
    },
    
    getSuggestedQuestions: async () => {
      const res = await axiosInstance.get('/ai/suggested-questions');
      return res.data;
    },
  },
};
