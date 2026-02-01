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
           teachers = teachers.filter(t => t.unitKerja === user.unit);
       }
    }

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
          results.push(null);
          errors.push(`Missing required fields for: ${teacher.nama || 'Unknown'}`);
          continue;
        }
        
        // Filter out null/undefined values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanData: any = {
          nuptk: String(teacher.nuptk),
          nama: String(teacher.nama),
        };
        
        // Map optional fields
        if (teacher.status) cleanData.status = teacher.status;
        if (teacher.unitKerja) cleanData.unitKerja = teacher.unitKerja;
        else if (teacher.satminkal) cleanData.unitKerja = teacher.satminkal; // Fallback for legacy
        
        if (teacher.pendidikanTerakhir) cleanData.pendidikanTerakhir = teacher.pendidikanTerakhir;
        if (teacher.tmt) cleanData.tmt = teacher.tmt;
        if (teacher.kecamatan) cleanData.kecamatan = teacher.kecamatan;
        if (teacher.mapel) cleanData.mapel = teacher.mapel;
        if (teacher.phoneNumber) cleanData.phoneNumber = teacher.phoneNumber;
        if (teacher.email) cleanData.email = teacher.email;
        if (teacher.isCertified !== undefined) cleanData.isCertified = teacher.isCertified;
        if (teacher.isVerified !== undefined) cleanData.isVerified = teacher.isVerified; // NEW
        if (teacher.pdpkpnu) cleanData.pdpkpnu = teacher.pdpkpnu;
        
        // Identity
        if (teacher.tempatLahir) cleanData.tempatLahir = teacher.tempatLahir;
        if (teacher.tanggalLahir) cleanData.tanggalLahir = teacher.tanggalLahir;
        if (teacher.nip) cleanData.nip = teacher.nip;
        if (teacher.jenisKelamin) cleanData.jenisKelamin = teacher.jenisKelamin;
        if (teacher.birthPlace) cleanData.tempatLahir = teacher.birthPlace; // Fallback
        if (teacher.birthDate) cleanData.tanggalLahir = teacher.birthDate; // Fallback

        // Check for duplicate
        const existing = await ctx.db
            .query("teachers")
            .withIndex("by_nuptk", (q) => q.eq("nuptk", teacher.nuptk))
            .first();
        
        try {
            if (!existing) {
                const id = await ctx.db.insert("teachers", {
                    ...cleanData,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                });
                results.push(id);
            } else {
                // UPDATE EXISTING RECORD (UPSERT)
                // This allows re-importing to fix missing fields or update data
                await ctx.db.patch(existing._id, {
                    ...cleanData,
                    updatedAt: now,
                });
                results.push(existing._id);
            }
        } catch (err) {
            results.push(null);
            errors.push(`Error for ${teacher.nama}: ${(err as Error).message}`);
        }
      } catch (err) {
        results.push(null);
        errors.push(`Error for ${teacher.nama || 'Unknown'}: ${(err as Error).message}`);
      }
    }
    
    return { 
      count: results.filter(id => id !== null).length, 
      ids: results,
      errors: errors.length > 0 ? errors : undefined,
      version: "2.0 (Fix Upsert)" 
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

// NEW: Robust Import Mutation (Replaces bulkCreate)
export const importTeachers = mutation({
  args: {
    teachers: v.array(v.any()), // Accept loose JSON to prevent validation errors before processing
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let success = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const t of args.teachers) {
      try {
        // 1. Sanitize & Normalize Data
        const nuptk = String(t.nuptk || t.NUPTK || "").trim();
        const nama = String(t.nama || t.NAMA || t.Name || "").trim();

        if (!nuptk || !nama) continue; // Skip invalid rows

        // Map Fields (Prioritize New Names, Fallback to Old/Excel Names)
        const unit = t.unitKerja || t.satminkal || t.SATMINKAL || t['Unit Kerja'] || t.sekolah || "";
        const status = t.status || t.STATUS || t.Status || "GTT";
        const tmt = t.tmt || t.TMT || "";
        const pendidikan = t.pendidikanTerakhir || t.pendidikan || t.PENDIDIKAN || "";
        const mapel = t.mapel || t.MAPEL || t.jabatan || "";
        
        const cleanData = {
          nuptk,
          nama,
          unitKerja: unit,
          status: status,
          tmt: tmt,
          pendidikanTerakhir: pendidikan,
          mapel: mapel,
          // Optional identitas
          nip: t.nip || t.NIP || undefined,
          tempatLahir: t.tempatLahir || t.birthPlace || undefined,
          tanggalLahir: t.tanggalLahir || t.birthDate || undefined,
          jenisKelamin: t.jenisKelamin || t.jk || undefined,
          pdpkpnu: t.pdpkpnu || "Belum",
          isCertified: t.isCertified === true || t.isCertified === "true",
          
          updatedAt: now,
        };

        // 2. Check Existing
        const existing = await ctx.db
          .query("teachers")
          .withIndex("by_nuptk", q => q.eq("nuptk", nuptk))
          .first();

        if (existing) {
          // UPSERT (Update)
          await ctx.db.patch(existing._id, cleanData);
          updated++;
        } else {
          // INSERT (New)
          // Convex requires all fields to match schema structure
          // We spread cleanData and ensure required fields (if any) are present
          await ctx.db.insert("teachers", {
            ...cleanData,
            isActive: true,
            createdAt: now,
          });
          success++;
        }
      } catch (err: any) {
        console.error(`Import Error for ${t.nama}:`, err);
        errors.push(`${t.nama}: ${err.message}`);
      }
    }

    return { 
      count: success + updated, 
      new: success, 
      updated: updated, 
      errors, 
      version: "3.0 (Fresh Import)" 
    };
  },
});
