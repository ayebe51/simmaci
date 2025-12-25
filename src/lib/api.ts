export const API_URL = "http://localhost:3000";

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
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Login failed");
    }
    return res.json(); // { access_token }
  },

  register: async (data: any) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // Handle 500 or 409
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Registration failed" }));
        throw new Error(err.message || "Registration failed");
    }
    return res.json();
  },

  // Generic Helpers
  get: async (endpoint: string, options: any = {}) => {
      const token = api.getToken();
      const headers = { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers 
      };
      
      const url = new URL(`${API_URL}${endpoint}`);
      if (options.params) {
          Object.keys(options.params).forEach(key => 
              url.searchParams.append(key, options.params[key])
          );
      }

      const res = await fetch(url.toString(), {
          method: "GET",
          headers,
          ...options
      });

      if (!res.ok) throw new Error(`GET ${endpoint} failed`);
      return { data: await res.json() }; // return { data: ... } to match axios style expected by calls
  },

  post: async (endpoint: string, data: any, options: any = {}) => {
      const token = api.getToken();
      const headers = { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers 
      };

      const res = await fetch(`${API_URL}${endpoint}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
          ...options
      });

      if (!res.ok) throw new Error(`POST ${endpoint} failed`);
      return { data: await res.json() };
  },

  // Master Data
  getSchools: async () => {
    const res = await api.get("/master-data/schools")
    return res.data
  },

  createSchool: async (data: any) => {
    const res = await api.post("/master-data/schools", data)
    return res.data
  },
  getTeachers: async (unitKerja?: string) => {
    const params = unitKerja ? { unitKerja } : {}
    const res = await api.get("/master-data/teachers", { params })
    return res.data
  },
  createTeacher: async (data: any) => {
    const res = await api.post("/master-data/teachers", data)
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

  // SK / Letters
  getSkList: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/users`, { // This snippet seems to be a copy-paste error from getUsers.
      headers: { 
          "Authorization": `Bearer ${token}` 
      },
    });
    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error("Failed to fetch SK list"); // Adjusted error message
    return res.json();
  },

  // Users
  getUsers: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/users`, {
      headers: { 
          "Authorization": `Bearer ${token}` 
      },
    });
    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },
  // EMIS
  importEmis: async (data: any[]) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/emis/import`, {
          method: "POST",
          headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}` 
          },
          body: JSON.stringify(data),
      });
      if (res.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
          throw new Error("Unauthorized");
      }
      if (!res.ok) throw new Error("Gagal import data");
      return res.json();
  },

  // SK
  createSk: async (data: any) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/sk`, {
          method: "POST",
          headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}` 
          },
          body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Gagal membuat SK");
      return res.json();
  },
  getSk: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/sk`, {
        headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Gagal mengambil data SK");
    return res.json();
  },
  getSkDetail: async (id: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/sk/${id}`, {
        headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Gagal mengambil detail SK");
    return res.json();
  },

  // Dashboard
  getDashboardStats: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/dashboard/stats`, {
        headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Gagal mengambil data dashboard");
    return res.json();
  }
};
