import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all teachers with optional filters
export const list = query({
  args: {
    unitKerja: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    isCertified: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let teachers = await ctx.db
      .query("teachers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Apply filters
    if (args.unitKerja && args.unitKerja !== "all") {
      // Case-insensitive match for unitKerja
      const searchUnit = args.unitKerja.toLowerCase().trim();
      teachers = teachers.filter(t => 
        t.unitKerja?.toLowerCase().trim() === searchUnit
      );
    }
    
    if (args.kecamatan && args.kecamatan !== "all") {
      teachers = teachers.filter(t => t.kecamatan === args.kecamatan);
    }
    
    if (args.isCertified && args.isCertified !== "all") {
      const certified = args.isCertified === "true";
      teachers = teachers.filter(t => t.isCertified === certified);
    }
    
    return teachers;
  },
});

// Get single teacher by ID
export const get = query({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get teacher by NUPTK
export const getByNuptk = query({
  args: { nuptk: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teachers")
      .withIndex("by_nuptk", (q) => q.eq("nuptk", args.nuptk))
      .first();
  },
});

// Create new teacher
export const create = mutation({
  args: {
    nuptk: v.string(),
    nama: v.string(),
    nip: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    pendidikanTerakhir: v.optional(v.string()),
    mapel: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    status: v.optional(v.string()),
    tmt: v.optional(v.string()),  // NEW: Tanggal Mulai Tugas
    isCertified: v.optional(v.boolean()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    pdpkpnu: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check for duplicate NUPTK
    const existing = await ctx.db
      .query("teachers")
      .withIndex("by_nuptk", (q) => q.eq("nuptk", args.nuptk))
      .first();
    
    if (existing) {
      throw new Error(`Teacher with NUPTK ${args.nuptk} already exists`);
    }
    
    return await ctx.db.insert("teachers", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update teacher
export const update = mutation({
  args: {
    id: v.id("teachers"),
    nuptk: v.optional(v.string()),
    nama: v.optional(v.string()),
    nip: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    pendidikanTerakhir: v.optional(v.string()),
    mapel: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    status: v.optional(v.string()),
    tmt: v.optional(v.string()),  // NEW: Tanggal Mulai Tugas
    isCertified: v.optional(v.boolean()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    pdpkpnu: v.optional(v.string()),
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

// Delete teacher (soft delete)
export const remove = mutation({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

// Bulk delete all teachers (hard delete)
export const bulkDelete = mutation({
  args: {},
  handler: async (ctx) => {
    const allTeachers = await ctx.db.query("teachers").collect();
    for (const teacher of allTeachers) {
      await ctx.db.delete(teacher._id);
    }
    return { count: allTeachers.length };
  },
});

// Bulk create teachers (for import) - ULTRA FLEXIBLE VERSION
export const bulkCreate = mutation({
  args: {
    teachers: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results = [];
    const errors = [];
    
    for (const teacher of args.teachers) {
      try {
        // Ensure required fields exist
        if (!teacher.nuptk || !teacher.nama) {
          errors.push(`Missing required fields for: ${teacher.nama || 'Unknown'}`);
          continue;
        }
        
        // Filter out null/undefined values
        const cleanData: any = {
          nuptk: String(teacher.nuptk),
          nama: String(teacher.nama),
        };
        
        // Only add non-null optional fields
        if (teacher.nip) cleanData.nip = String(teacher.nip);
        if (teacher.jenisKelamin) cleanData.jenisKelamin = String(teacher.jenisKelamin);
        if (teacher.tempatLahir) cleanData.tempatLahir = String(teacher.tempatLahir);
        if (teacher.tanggalLahir) cleanData.tanggalLahir = String(teacher.tanggalLahir);
        if (teacher.pendidikanTerakhir) cleanData.pendidikanTerakhir = String(teacher.pendidikanTerakhir);
        if (teacher.mapel) cleanData.mapel = String(teacher.mapel);
        if (teacher.unitKerja) cleanData.unitKerja = String(teacher.unitKerja);
        if (teacher.kecamatan) cleanData.kecamatan = String(teacher.kecamatan);
        if (teacher.status) cleanData.status = String(teacher.status);
        if (teacher.tmt) cleanData.tmt = String(teacher.tmt);  // NEW: TMT field
        if (teacher.phoneNumber) cleanData.phoneNumber = String(teacher.phoneNumber);
        if (teacher.email) cleanData.email = String(teacher.email);
        if (teacher.pdpkpnu) cleanData.pdpkpnu = String(teacher.pdpkpnu);
        if (teacher.isCertified !== undefined && teacher.isCertified !== null) {
          cleanData.isCertified = Boolean(teacher.isCertified);
        }
        
        // Check duplicates
        const existing = await ctx.db
          .query("teachers")
          .withIndex("by_nuptk", (q) => q.eq("nuptk", cleanData.nuptk))
          .first();
        
        if (!existing) {
          const id = await ctx.db.insert("teachers", {
            ...cleanData,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          results.push(id);
        } else {
          errors.push(`Duplicate NUPTK: ${teacher.nuptk}`);
        }
      } catch (err: any) {
        errors.push(`Error for ${teacher.nama}: ${err.message}`);
      }
    }
    
    return { 
      count: results.length, 
      ids: results,
      errors: errors.length > 0 ? errors : undefined 
    };
  },
});

// Get teacher count by filters
export const count = query({
  args: {
    unitKerja: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let teachers = await ctx.db
      .query("teachers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    if (args.unitKerja) {
      teachers = teachers.filter(t => t.unitKerja === args.unitKerja);
    }
    
    if (args.kecamatan) {
      teachers = teachers.filter(t => t.kecamatan === args.kecamatan);
    }
    
    return teachers.length;
  },
});
