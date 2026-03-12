import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

import { paginationOptsValidator } from "convex/server";
import { validateSession } from "./auth_helpers";

// 🔥 PAGINATED LIST
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    namaSekolah: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // AUTHENTICATION
    let user: any = null;
    if (args.token) {
        user = await validateSession(ctx, args.token);
    } else {
        const identity = await ctx.auth.getUserIdentity();
        if (identity?.email) {
            user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", identity.email!)).first();
        }
    }

    if (!user) {
        return { page: [], isDone: true, continueCursor: "" }; // Unauthenticated
    }

    const role = (user.role || "").toLowerCase();
    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    const isSuper = superRoles.some(r => role.includes(r));
    let userUnit = "";

    if (!isSuper) {
        if (user.role === "operator") {
            if (user.unit) {
                userUnit = user.unit;
            } else {
                return { page: [], isDone: true, continueCursor: "" }; // Operator without unit sees nothing
            }
        } else {
            return { page: [], isDone: true, continueCursor: "" }; // Other roles
        }
    }

    // Determine Filter Targets
    // If Operator, FORCE targetSchool to be their unit. They cannot override it.
    const targetSchool = userUnit || (args.namaSekolah !== "all" ? args.namaSekolah : undefined);
    const targetKecamatan = args.kecamatan !== "all" ? args.kecamatan : undefined;
    const targetStatus = args.status !== "all" ? args.status : undefined;

    // 1. SEARCH SCENARIO
    if (args.search) {
        let searchQ = ctx.db.query("students")
            .withSearchIndex("search_students", q => q.search("nama", args.search!));

        if (targetSchool !== undefined) {
            searchQ = searchQ.filter(q => q.eq(q.field("namaSekolah"), targetSchool));
        } else if (targetKecamatan !== undefined) {
            searchQ = searchQ.filter(q => q.eq(q.field("kecamatan"), targetKecamatan));
        }

        if (targetStatus !== undefined) {
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
    }

    return await paginatedQuery.paginate(args.paginationOpts);
  },
});

export const list = query({
  args: {
    namaSekolah: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // AUTHENTICATION
    let user: any = null;
    if (args.token) {
        user = await validateSession(ctx, args.token);
    } else {
        const identity = await ctx.auth.getUserIdentity();
        if (identity?.email) {
            user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", identity.email!)).first();
        }
    }

    if (!user) return [];

    let students = await ctx.db.query("students").collect();
    
    // RBAC FILTERING
    const role = (user.role || "").toLowerCase();
    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    const isSuper = superRoles.some(r => role.includes(r));
    
    if (!isSuper) {
        if (user.role === "operator") {
            if (user.unit) {
                // Strict filter for operators
                students = students.filter(s => s.namaSekolah === user.unit);
            } else {
                return []; // Operator without unit sees nothing
            }
        } else {
            return []; // Other non-admins see nothing
        }
    }

    // Apply filters
    if (isSuper && args.namaSekolah && args.namaSekolah !== "all") {
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
    provinsi: v.optional(v.string()),
    kabupaten: v.optional(v.string()),
    kecamatan: v.optional(v.any()),
    kelurahan: v.optional(v.string()),
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
    provinsi: v.optional(v.string()),
    kabupaten: v.optional(v.string()),
    kecamatan: v.optional(v.any()),
    kelurahan: v.optional(v.string()),
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
    try {
        const { id, ...updates } = args;

        const existing = await ctx.db.get(id);
        if (!existing) {
            throw new ConvexError(`Data siswa dengan ID ${id} tidak ditemukan`);
        }
        
        // Define allowed fields for schema safety
        const allowedFields = [
          "nisn", "nik", "nama", "nomorIndukMaarif", "jenisKelamin", 
          "tempatLahir", "tanggalLahir", "namaAyah", "namaIbu", "alamat", 
          "provinsi", "kabupaten", "kecamatan", "kelurahan", "namaSekolah", "npsn", "kelas", "nomorTelepon", 
          "namaWali", "photoId", "status", "isVerified", "qrCode"
        ];

        // 1. Build sanitized patch
        const patch: any = { updatedAt: Date.now() };
        
        for (const field of allowedFields) {
            if ((updates as any)[field] !== undefined) {
                let val = (updates as any)[field];
                
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
        
        return existing._id;
    } catch (e: any) {
        console.error("CRITICAL FAIL in students:update :", e);
        if (e instanceof ConvexError) throw e;
        throw new ConvexError(e.message || "Gagal memperbarui data siswa. Terjadi kesalahan internal.");
    }
  },
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
      provinsi: v.optional(v.string()),
      kabupaten: v.optional(v.string()),
      kecamatan: v.optional(v.any()),
      kelurahan: v.optional(v.string()),
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

// Count active students for transition (Hyper-resilient version)
export const countActiveBySchool = query({
  args: { namaSekolah: v.any() }, // Use any() to avoid validator crashes
  handler: async (ctx, args) => {
    try {
        const name = String(args.namaSekolah || "").trim();
        if (!name) return 0;

        // Try using the combined index first (efficient)
        // We use .take(5000) as an absolute safety ceiling for MI-scale data
        const students = await ctx.db
            .query("students")
            .withIndex("unique_school_status", (q) => q.eq("namaSekolah", name).eq("status", "Aktif"))
            .take(5000);
            
        return students.length;
    } catch (e) {
        console.warn("[Convex] countActiveBySchool Index Fallback:", e);
        try {
            const name = String(args.namaSekolah || "").trim();
            // Fallback to basic school index + JS filter if combined index is not yet ready
            const alt = await ctx.db
              .query("students")
              .withIndex("by_school", (q) => q.eq("namaSekolah", name))
              .take(5000);
            return alt.filter(s => s.status === "Aktif").length;
        } catch (innerE) {
            console.error("[Convex] countActiveBySchool Fatal:", innerE);
            return 0; // Total safety
        }
    }
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
// ?? PUBLIC VERIFICATION FOR STUDENT CARD (Unauthenticated / NISN)
export const getByNisnPublic = query({
  args: { nisn: v.string() },
  handler: async (ctx, args) => {
    const student = await ctx.db
      .query("students")
      .withIndex("by_nisn", (q) => q.eq("nisn", args.nisn))
      .first();

    if (!student) return null;

    return {
      nama: student.nama,
      nisn: student.nisn,
      nik: student.nik,
      namaSekolah: student.namaSekolah,
      status: student.status
    };
  },
});

// Get distinct kelas values for a school (auto-sync for attendance)
export const getDistinctKelas = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return [];

    const students = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("namaSekolah"), school.nama))
      .collect();

    // Extract unique kelas values
    const kelasSet = new Set();
    const kelasList = [];
    for (const s of students) {
      const kelas = s.kelas;
      if (kelas && !kelasSet.has(kelas)) {
        kelasSet.add(kelas);
        kelasList.push({
          kelas: String(kelas),
          count: 0,
        });
      }
    }

    // Count students per class
    for (const item of kelasList) {
      item.count = students.filter((s) => String(s.kelas) === item.kelas).length;
    }

    // Sort naturally
    kelasList.sort((a, b) => a.kelas.localeCompare(b.kelas, undefined, { numeric: true }));
    return kelasList;
  },
});

// Get students by kelas and school (for attendance validation)
export const getByKelas = query({
  args: { schoolId: v.id("schools"), kelas: v.string() },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return [];

    const students = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("namaSekolah"), school.nama))
      .collect();

    return students
      .filter((s) => String(s.kelas) === args.kelas)
      .map((s) => ({
        _id: s._id,
        nisn: s.nisn,
        nama: s.nama,
        kelas: s.kelas,
      }));
  },
});

// 🔥 BATCH PROMOTION & GRADUATION (Updated with Chunking & Safety)
export const batchTransition = mutation({
  args: {
    schoolId: v.id("schools"),
    token: v.string(),
    transitionTimestamp: v.optional(v.number()), // Shared timestamp from frontend
  },
  handler: async (ctx, args) => {
    // 1. AUTHENTICATION
    const user = await validateSession(ctx, args.token);
    if (!user) throw new Error("Unauthorized");

    // 2. SCHOOL CHECK
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");

    // 3. GET ACTIVE STUDENTS (Limited to 200 per batch for safe write limits)
    const BATCH_SIZE = 200;
    const students = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("namaSekolah", school.nama))
      .filter((q) => q.eq(q.field("status"), "Aktif"))
      .take(BATCH_SIZE);

    if (students.length === 0) {
      return { processed: 0, promoted: 0, graduated: 0, skipped: 0, isDone: true };
    }

    console.log(`[BatchTransition] Processing chunk of ${students.length} students for ${school.nama}`);

    const now = args.transitionTimestamp || Date.now();
    let promoted = 0;
    let graduated = 0;
    let skipped = 0;

    const romanMap: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
      VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12
    };

    const toRoman = (num: number): string => {
      const entry = Object.entries(romanMap).find(([_, val]) => val === num);
      return entry ? entry[0] : String(num);
    };

    // 4. TRANSITION LOGIC
    for (const student of students) {
      try {
        const currentKelas = String(student.kelas || "").trim();
        if (!currentKelas) {
          await ctx.db.patch(student._id, { 
            lastTransitionAt: now,
            updatedAt: now 
          });
          skipped++;
          continue;
        }

        const gradeMatch = currentKelas.match(/^([0-9]+|[IVXLC]+)/i);
        if (!gradeMatch) {
          await ctx.db.patch(student._id, { 
            lastTransitionAt: now,
            updatedAt: now 
          });
          skipped++;
          continue;
        }

        const gradeStr = gradeMatch[1].toUpperCase();
        let gradeNum = 0;
        if (romanMap[gradeStr]) {
          gradeNum = romanMap[gradeStr];
        } else {
          gradeNum = parseInt(gradeStr, 10);
        }

        if (isNaN(gradeNum) || gradeNum === 0) {
          await ctx.db.patch(student._id, { 
            lastTransitionAt: now,
            updatedAt: now 
          });
          skipped++;
          continue;
        }

        const sNama = school.nama.toUpperCase();
        const isMI = sNama.includes("MI ") || sNama.includes(" MI") || sNama.includes("SD ");
        const isMTs = sNama.includes("MTS") || sNama.includes("SMP ");
        const isMA = sNama.includes("MA ") || sNama.includes(" MA") || sNama.includes("SMA ") || sNama.includes("SMK");

        const isGraduating =
          (isMI && gradeNum >= 6) ||
          (isMTs && gradeNum >= 9) ||
          (isMA && gradeNum >= 12);

        if (isGraduating) {
          await ctx.db.patch(student._id, {
            status: "Lulus",
            lastTransitionAt: now,
            updatedAt: now,
          });
          graduated++;
        } else {
          const newGradeNum = gradeNum + 1;
          const newGradeStr = romanMap[gradeStr] ? toRoman(newGradeNum) : String(newGradeNum);
          const newKelas = currentKelas.replace(gradeMatch[1], newGradeStr);

          await ctx.db.patch(student._id, {
            kelas: newKelas,
            lastTransitionAt: now,
            updatedAt: now,
          });
          promoted++;
        }
      } catch (err) {
        console.error(`[BatchTransition] Error processing student ${student._id}:`, err);
        throw err;
      }
    }

    // Check if more students exist (that haven't been processed in this 'now' window)
    // To be safer, we check for students WITHOUT the current timestamp marker
    const moreStudents = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("namaSekolah", school.nama))
      .filter((q) => q.and(
          q.eq(q.field("status"), "Aktif"),
          q.neq(q.field("lastTransitionAt"), now)
      ))
      .first();

    const isDone = !moreStudents;

    if (isDone) {
      await ctx.db.insert("activity_logs", {
        user: (user as any).name || "Admin",
        role: (user as any).role || "Operator",
        action: "batch_transition",
        details: `Selesai proses kenaikan kelas di ${school.nama}.`,
        timestamp: now,
      });
    }

    return { 
      processed: students.length, 
      promoted, 
      graduated, 
      skipped, 
      isDone 
    };
  },
});
