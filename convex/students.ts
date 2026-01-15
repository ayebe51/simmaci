import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all students with optional filters
export const list = query({
  args: {
    namaSekolah: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    
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
    nama: v.string(),
    nomorIndukMaarif: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    namaSekolah: v.optional(v.string()),
    kelas: v.optional(v.string()),
    nomorTelepon: v.optional(v.string()),
    namaWali: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if NISN already exists
    const existing = await ctx.db
      .query("students")
      .withIndex("by_nisn", (q) => q.eq("nisn", args.nisn))
      .first();
    
    if (existing) {
      throw new Error("NISN sudah terdaftar");
    }
    
    return await ctx.db.insert("students", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update student
export const update = mutation({
  args: {
    id: v.id("students"),
    nisn: v.optional(v.string()),
    nama: v.optional(v.string()),
    npsn: v.optional(v.string()), // Added npsn as per the instruction's implied change
    nomorIndukMaarif: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    namaSekolah: v.optional(v.string()),
    kelas: v.optional(v.string()),
    nomorTelepon: v.optional(v.string()),
    namaWali: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
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
      nama: v.string(),
      nomorIndukMaarif: v.optional(v.string()),
      jenisKelamin: v.optional(v.string()),
      tempatLahir: v.optional(v.string()),
      tanggalLahir: v.optional(v.string()),
      alamat: v.optional(v.string()),
      kecamatan: v.optional(v.string()),
      namaSekolah: v.optional(v.string()),
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
