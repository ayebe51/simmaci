import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

import { paginationOptsValidator } from "convex/server";

// 🔥 PAGINATED LIST
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    namaSekolah: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    let userUnit = "";
    
    // RBAC: Check User Role
    if (identity && identity.email) {
       const user = await ctx.db
         .query("users")
         .withIndex("by_email", (q) => q.eq("email", identity.email!))
         .first();

       if (user && user.role === "operator" && user.unit) {
           userUnit = user.unit;
       }
    }

    // Determine Filter Targets
    const targetSchool = userUnit || (args.namaSekolah !== "all" ? args.namaSekolah : undefined);
    const targetKecamatan = args.kecamatan !== "all" ? args.kecamatan : undefined;
    const targetStatus = args.status !== "all" ? args.status : undefined;

    // 1. SEARCH SCENARIO
    if (args.search) {
        let searchQ = ctx.db.query("students")
            .withSearchIndex("search_students", q => q.search("nama", args.search!));

        if (targetSchool) {
            searchQ = searchQ.filter(q => q.eq(q.field("namaSekolah"), targetSchool));
        } else if (targetKecamatan) {
            searchQ = searchQ.filter(q => q.eq(q.field("kecamatan"), targetKecamatan));
        }

        if (targetStatus) {
            searchQ = searchQ.filter(q => q.eq(q.field("status"), targetStatus));
        }

        return await searchQ.paginate(args.paginationOpts);
    }

    // 2. FILTER SCENARIO
    const q = ctx.db.query("students");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let paginatedQuery: any = q;

    if (targetSchool) {
        paginatedQuery = q.withIndex("by_school", q => q.eq("namaSekolah", targetSchool));
    } else if (targetKecamatan) {
        paginatedQuery = q.withIndex("by_kecamatan", q => q.eq("kecamatan", targetKecamatan));
    } else if (targetStatus) {
        paginatedQuery = q.withIndex("by_status", q => q.eq("status", targetStatus));
    } else {
        paginatedQuery = q.order("desc"); // Default sort (newest maybe? or just default)
    }

    return await paginatedQuery.paginate(args.paginationOpts);
  },
});

// Get all students with optional filters
export const list = query({
  args: {
    namaSekolah: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    
    // RBAC: Check if user is an Operator
    const identity = await ctx.auth.getUserIdentity();
    if (identity && identity.email) {
       const email = identity.email;
       const user = await ctx.db
         .query("users")
         .withIndex("by_email", (q) => q.eq("email", email))
         .first();

       if (user && user.role === "operator" && user.unit) {
           // Strict filter for operators
           const userUnit = user.unit;
           students = students.filter(s => s.namaSekolah === userUnit);
       }
    }

    // Apply filters
    if (args.namaSekolah && args.namaSekolah !== "all") {
      students = students.filter(s => s.namaSekolah === args.namaSekolah);
    }
    
    return students;
  },
});

// Get single student by ID
export const get = query({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get student by NISN
export const getByNisn = query({
  args: { nisn: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("students")
      .withIndex("by_nisn", (q) => q.eq("nisn", args.nisn))
      .first();
  },
});

// Create new student
export const create = mutation({
  args: {
    nisn: v.any(),
    nama: v.any(),
    nik: v.optional(v.any()),
    nomorIndukMaarif: v.optional(v.any()),
    jenisKelamin: v.optional(v.any()),
    tempatLahir: v.optional(v.any()),
    tanggalLahir: v.optional(v.any()),
    namaAyah: v.optional(v.any()),
    namaIbu: v.optional(v.any()),
    alamat: v.optional(v.any()),
    kecamatan: v.optional(v.any()),
    namaSekolah: v.optional(v.any()),
    npsn: v.optional(v.any()),
    kelas: v.optional(v.any()),
    nomorTelepon: v.optional(v.any()),
    namaWali: v.optional(v.any()),
    photoId: v.optional(v.any()),
    status: v.optional(v.any()),
    isVerified: v.optional(v.any()),
    qrCode: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    try {
      const now = Date.now();
      
      // Check if NISN already exists
      const existing = await ctx.db
        .query("students")
        .withIndex("by_nisn", (q) => q.eq("nisn", args.nisn))
        .first();
      
      if (existing) {
        throw new ConvexError("NISN sudah terdaftar");
      }

      // Normalize Jenis Kelamin (L/P)
      let jk = args.jenisKelamin;
      if (jk === "Laki-laki") jk = "L";
      if (jk === "Perempuan") jk = "P";
      
      return await ctx.db.insert("students", {
        ...args,
        jenisKelamin: jk, // Use normalized value
        status: args.status || "Aktif",
        createdAt: now,
        updatedAt: now,
      });
    } catch (e: any) {
      if (e instanceof ConvexError) throw e;
      console.error("Failed to create student:", e);
      throw new ConvexError(e.message || "Gagal membuat data siswa");
    }
  },
});

// Update student
export const update = mutation({
  args: {
    id: v.id("students"),
    nisn: v.optional(v.any()),
    nik: v.optional(v.any()),
    nama: v.optional(v.any()),
    npsn: v.optional(v.any()),
    nomorIndukMaarif: v.optional(v.any()),
    jenisKelamin: v.optional(v.any()),
    tempatLahir: v.optional(v.any()),
    tanggalLahir: v.optional(v.any()),
    namaAyah: v.optional(v.any()),
    namaIbu: v.optional(v.any()),
    alamat: v.optional(v.any()),
    kecamatan: v.optional(v.any()),
    namaSekolah: v.optional(v.any()),
    kelas: v.optional(v.any()),
    nomorTelepon: v.optional(v.any()),
    namaWali: v.optional(v.any()),
    photoId: v.optional(v.any()),
    isVerified: v.optional(v.any()),
    qrCode: v.optional(v.any()),
    status: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("debug_logs", {
        action: "students:update",
        report: `START: ${args.id}`,
        status: "processing",
        createdAt: Date.now()
    });

    try {
        const { id, ...updates } = args;

        const existing = await ctx.db.get(id);
        if (!existing) {
            await ctx.db.patch(logId, { status: "not_found", report: `Student ID ${id} not found` });
            throw new ConvexError(`Data siswa dengan ID ${id} tidak ditemukan`);
        }
        
        // Define allowed fields for schema safety
        const allowedFields = [
          "nisn", "nik", "nama", "nomorIndukMaarif", "jenisKelamin", 
          "tempatLahir", "tanggalLahir", "namaAyah", "namaIbu", "alamat", 
          "kecamatan", "namaSekolah", "npsn", "kelas", "nomorTelepon", 
          "namaWali", "photoId", "status", "isVerified", "qrCode"
        ];

        // 1. Build sanitized patch
        const patch: any = { updatedAt: Date.now() };
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                let val = updates[field];
                
                // Normalization Logic
                if (field === 'jenisKelamin') {
                    if (val === "Laki-laki") val = "L";
                    if (val === "Perempuan") val = "P";
                }
                if (field === 'nisn' || field === 'nama') {
                    if (val !== null && val !== undefined) val = String(val).trim();
                }
                if (field === 'status') {
                    val = val || "Aktif";
                }
                
                patch[field] = val;
            }
        }

        console.log(`[Mutation] Patching student ${id}:`, JSON.stringify(patch));
        await ctx.db.patch(existing._id, patch);
        
        await ctx.db.patch(logId, { status: "success", report: `Patched ${id}` });
        return existing._id;
    } catch (e: any) {
        console.error("CRITICAL FAIL in students:update :", e);
        await ctx.db.patch(logId, { status: "error", report: String(e.message || e) });
        if (e instanceof ConvexError) throw e;
        throw new ConvexError(e.message || "Gagal memperbarui data siswa. Terjadi kesalahan internal.");
    }
  },
});

// Debug Query to see logs
export const getDebugLogs = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("debug_logs").order("desc").take(10);
    }
});

// Delete student
export const remove = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Bulk create students (for import)
export const bulkCreate = mutation({
  args: {
    students: v.array(v.object({
      nisn: v.any(),
      nama: v.any(),
      nik: v.optional(v.any()),
      nomorIndukMaarif: v.optional(v.any()),
      jenisKelamin: v.optional(v.any()),
      tempatLahir: v.optional(v.any()),
      tanggalLahir: v.optional(v.any()),
      namaAyah: v.optional(v.any()),
      namaIbu: v.optional(v.any()),
      alamat: v.optional(v.any()),
      kecamatan: v.optional(v.any()),
      namaSekolah: v.optional(v.any()),
      npsn: v.optional(v.any()),
      kelas: v.optional(v.any()),
      nomorTelepon: v.optional(v.any()),
      namaWali: v.optional(v.any()),
      photoId: v.optional(v.any()),
      status: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results = [];
    
    for (const student of args.students) {
      // Check duplicates
      const existing = await ctx.db
        .query("students")
        .withIndex("by_nisn", (q) => q.eq("nisn", student.nisn))
        .first();
      
      if (!existing) {
        // Normalize Jenis Kelamin (L/P)
        let jk = student.jenisKelamin;
        if (jk === "Laki-laki") jk = "L";
        if (jk === "Perempuan") jk = "P";

        const id = await ctx.db.insert("students", {
          ...student,
          jenisKelamin: jk,
          status: student.status || "Aktif",
          createdAt: now,
          updatedAt: now,
        });
        results.push(id);
      }
    }
    
    return { count: results.length, ids: results };
  },
});

// Bulk update student status
export const bulkUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("students")),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, {
        status: args.status,
        updatedAt: now,
      });
    }
    return args.ids.length;
  },
});

// Get student count by filters
export const count = query({
  args: {
    namaSekolah: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.namaSekolah && args.namaSekolah !== "all") {
      const results = await ctx.db
        .query("students")
        .withIndex("by_school", (idx) => idx.eq("namaSekolah", args.namaSekolah!))
        .collect();
      return results.length;
    }
    
    const results = await ctx.db.query("students").collect();
    return results.length;
  },
});

// 🔥 UPLOAD PHOTO HELPER
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// 🔥 GET NORMALIZED PHOTO URL
export const getPhotoUrl = query({
  args: { photoId: v.any() }, // Use any to avoid crash on null/undefined from older frontend calls
  handler: async (ctx, args) => {
    try {
        if (!args.photoId || typeof args.photoId !== "string") return null;
        
        const id = args.photoId.trim();
        if (!id) return null;
        
        // If it's already a full URL or Google Drive link, return it
        if (id.startsWith("http")) return id;
        
        // If it looks like it's NOT a storage ID (e.g. too short or contains weird chars), skip
        // Convex storage IDs are usually long strings. 
        // We'll try to get it, and if it fails, we return null instead of crashing the query.
        return await ctx.storage.getUrl(id as any);
    } catch (e) {
        // console.error("getPhotoUrl Error:", e);
        return null; // Quietly return null on invalid ID formats
    }
  },
});

// 🔥 UPDATE PHOTO ID
export const updatePhoto = mutation({
    args: { id: v.id("students"), photoId: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { 
            photoId: args.photoId,
            updatedAt: Date.now()
        });
        return args.id;
    }
});

// 🔥 PUBLIC VERIFICATION FOR STUDENTS
export const verifyByNisn = query({
    args: { nisn: v.string() },
    handler: async (ctx, args) => {
        const student = await ctx.db
            .query("students")
            .withIndex("by_nisn", (q) => q.eq("nisn", args.nisn))
            .first();
        
        if (!student) return null;

        // Optionally get school details if helpful
        let school = null;
        if (student.npsn) {
            school = await ctx.db.query("schools").filter(q => q.eq(q.field("npsn"), student.npsn)).first();
        }

        return {
            ...student,
            schoolName: school?.nama || student.namaSekolah
        };
    }
});
