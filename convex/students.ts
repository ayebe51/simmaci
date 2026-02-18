import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

import { paginationOptsValidator } from "convex/server";

// 🔥 PAGINATED LIST
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    namaSekolah: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
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

    // 1. SEARCH SCENARIO
    if (args.search) {
        let searchQ = ctx.db.query("students")
            .withSearchIndex("search_students", q => q.search("nama", args.search!));

        if (targetSchool) {
            searchQ = searchQ.filter(q => q.eq(q.field("namaSekolah"), targetSchool));
        } else if (targetKecamatan) {
            searchQ = searchQ.filter(q => q.eq(q.field("kecamatan"), targetKecamatan));
        }

        return await searchQ.paginate(args.paginationOpts);
    }

    // 2. FILTER SCENARIO
    let q = ctx.db.query("students");

    if (targetSchool) {
        q = q.withIndex("by_school", q => q.eq("namaSekolah", targetSchool));
    } else if (targetKecamatan) {
        q = q.withIndex("by_kecamatan", q => q.eq("kecamatan", targetKecamatan));
    } else {
        q = q.order("desc"); // Default sort (newest maybe? or just default)
    }

    return await q.paginate(args.paginationOpts);
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
    nisn: v.string(),
    nik: v.optional(v.string()),
    nama: v.string(),
    nomorIndukMaarif: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    namaAyah: v.optional(v.string()),
    namaIbu: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    namaSekolah: v.optional(v.string()),
    npsn: v.optional(v.string()),
    kelas: v.optional(v.string()),
    nomorTelepon: v.optional(v.string()),
    namaWali: v.optional(v.string()),
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
        throw new Error("NISN sudah terdaftar");
      }

      // Normalize Jenis Kelamin (L/P)
      let jk = args.jenisKelamin;
      if (jk === "Laki-laki") jk = "L";
      if (jk === "Perempuan") jk = "P";
      
      return await ctx.db.insert("students", {
        ...args,
        jenisKelamin: jk, // Use normalized value
        createdAt: now,
        updatedAt: now,
      });
    } catch (e: any) {
      console.error("Failed to create student:", e);
      throw new Error(e.message || "Gagal membuat data siswa");
    }
  },
});

// Update student
export const update = mutation({
  args: {
    id: v.id("students"),
    nisn: v.optional(v.string()),
    nik: v.optional(v.string()),
    nama: v.optional(v.string()),
    npsn: v.optional(v.string()),
    nomorIndukMaarif: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    namaAyah: v.optional(v.string()),
    namaIbu: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    namaSekolah: v.optional(v.string()),
    kelas: v.optional(v.string()),
    nomorTelepon: v.optional(v.string()),
    namaWali: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Data siswa tidak ditemukan");
    }
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return id;
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
      nisn: v.string(),
      nik: v.optional(v.string()),
      nama: v.string(),
      nomorIndukMaarif: v.optional(v.string()),
      jenisKelamin: v.optional(v.string()),
      tempatLahir: v.optional(v.string()),
      tanggalLahir: v.optional(v.string()),
      namaAyah: v.optional(v.string()),
      namaIbu: v.optional(v.string()),
      alamat: v.optional(v.string()),
      kecamatan: v.optional(v.string()),
      namaSekolah: v.optional(v.string()),
      npsn: v.optional(v.string()),
      kelas: v.optional(v.string()),
      nomorTelepon: v.optional(v.string()),
      namaWali: v.optional(v.string()),
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
        const id = await ctx.db.insert("students", {
          ...student,
          createdAt: now,
          updatedAt: now,
        });
        results.push(id);
      }
    }
    
    return { count: results.length, ids: results };
  },
});

// Get student count by filters
export const count = query({
  args: {
    namaSekolah: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    
    if (args.namaSekolah) {
      students = students.filter(s => s.namaSekolah === args.namaSekolah);
    }
    
    return students.length;
  },
});
