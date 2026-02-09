import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { validateSession } from "./auth_helpers";

// --- STORAGE HELPERS ---
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getPhotoUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Get all teachers with optional filters
export const list = query({
  args: {
    unitKerja: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    isCertified: v.optional(v.string()),
    token: v.optional(v.string()), // New Secure Token arg
  },
  handler: async (ctx, args) => {
    try {
        let teachers = await ctx.db
          .query("teachers")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect();
        
        // RBAC: Check identity via Session Token
        let user = null;
        if (args.token) {
            user = await validateSession(ctx, args.token);
        } else {
            const identity = await ctx.auth.getUserIdentity();
            if (identity?.email) {
                 user = await ctx.db
                    .query("users")
                    .withIndex("by_email", (q) => q.eq("email", identity.email!))
                    .first();
            }
        }
    
        
        // RBAC Logic

        if (user && user.role === "operator" && user.unit) {
            teachers = teachers.filter(t => t.unitKerja === user.unit);
        }
    
        // Apply filters
        if (args.unitKerja && args.unitKerja !== "all") {
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
    } catch (error) {
        console.error("Error in teachers:list", error);
        return [];
    }
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

// --- RBAC HELPER ---
async function validateWriteAccess(ctx: MutationCtx, targetUnit: string | undefined, currentTeacherId?: Id<"teachers">) {
    const identity = await ctx.auth.getUserIdentity();
    
    // 1. If not logged in, throw error (Strict Mode)
    if (!identity) {
        throw new Error("Unauthorized: Harap login terlebih dahulu.");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();

    if (!user) {
        throw new Error("Unauthorized: User tidak ditemukan.");
    }

    // 2. Admin is God Mode
    if (user.role === 'admin') {
        return user; // Pass
    }

    // 3. Operator Logic
    if (user.role === 'operator') {
        // Enforce Unit
        if (!user.unit) {
            throw new Error("Forbidden: Akun operator tidak memiliki Unit Kerja.");
        }

        // A. If targetUnit is provided (Create/Update), it MUST match user.unit
        if (targetUnit && targetUnit.trim().toLowerCase() !== user.unit.trim().toLowerCase()) {
            throw new Error(`Forbidden: Anda tidak berhak mengelola data unit '${targetUnit}'.`);
        }

        // B. If acting on existing teacher (Update/Delete), verify ownership
        if (currentTeacherId) {
            const existing = await ctx.db.get(currentTeacherId);
            if (!existing) return user; // Let the mutation handle "not found"
            
            if (existing.unitKerja !== user.unit) {
                 throw new Error("Forbidden: Anda tidak memiliki akses ke guru ini.");
            }
        }

        return user;
    }

    throw new Error("Forbidden: Role tidak dikenali.");
}

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
    tmt: v.optional(v.string()),
    isCertified: v.optional(v.boolean()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    pdpkpnu: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // RBAC CHECK
    const user = await validateWriteAccess(ctx, args.unitKerja);
    
    // For Operators, FORCE unitKerja to match their account (Double Safety)
    const finalUnit = user.role === 'operator' ? user.unit : args.unitKerja;

    const now = Date.now();
    
    // Check for duplicate NUPTK
    const existing = await ctx.db
      .query("teachers")
      .withIndex("by_nuptk", (q) => q.eq("nuptk", args.nuptk))
      .first();
    
    if (existing) {
      // RBAC CHECK FOR UPDATE
      if (user.role === 'operator' && existing.unitKerja !== user.unit) {
          throw new Error("Forbidden: NUPTK terdaftar di sekolah lain.");
      }

      // UPSERT LOGIC: Update existing teacher for re-submission
      console.log(`Update Existing Teacher: ${args.nama} (${args.nuptk})`);
      await ctx.db.patch(existing._id, {
        ...args,
        unitKerja: finalUnit, // Ensure secure unit
        updatedAt: now,
      });
      return existing._id;
    }
    
    return await ctx.db.insert("teachers", {
      ...args,
      unitKerja: finalUnit, // Ensure secure unit
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
    tmt: v.optional(v.string()),
    isCertified: v.optional(v.boolean()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    pdpkpnu: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // RBAC CHECK
    // Pass ID to verify ownership of existing record
    // Pass new unitKerja to verify they aren't moving it to unauthorized unit
    await validateWriteAccess(ctx, updates.unitKerja, id);
    
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
    // RBAC CHECK
    await validateWriteAccess(ctx, undefined, args.id);

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

// Bulk delete all teachers (hard delete) - PROTECTED (Admin Only)
export const bulkDelete = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await validateWriteAccess(ctx, undefined);
    if (user.role !== 'admin') {
        throw new Error("Forbidden: Hanya Admin yang bisa menghapus semua data.");
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teachers: v.array(v.any()),
    isFullSync: v.optional(v.boolean()), // Enable Full Sync Mode
    suratPermohonanUrl: v.optional(v.string()), // Batch Request File
  },
  handler: async (ctx, args) => {
    const user = await validateWriteAccess(ctx, undefined);

    try {
        const now = Date.now();
        const results = [];
        const errors = [];
        
        // Track NUPTKs processed in this batch for Full Sync
        const processedNuptks = new Set<string>();
        const unitsInBatch = new Set<string>();

        // If Operator, simplify things: The batch MUST be for their unit.
        // We will override any excel unit with User's unit.
        const enforcedUnit = user.role === 'operator' ? user.unit : null;

        for (const teacher of args.teachers) {
        if (!teacher) continue; // Skip nulls
        
        try {
            if (teacher.nuptk) processedNuptks.add(String(teacher.nuptk).trim());
            // Unit Strategy:
            // - operator: enforcedUnit
            // - admin: use provided unit or fallback
            // We'll resolve this in cleanData below
        } catch {
            // Ignore pre-processing errors
        }

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
            nuptk: String(teacher.nuptk).trim(),
            nama: String(teacher.nama).trim(),
            };
            
            // Map optional fields
            // FIXED: Force 'active' for bulk upload to bypass "Pengajuan SK" (Draft)
            cleanData.status = "active"; 
            
            // --- UNIT LOGIC ---
            if (enforcedUnit) {
                cleanData.unitKerja = enforcedUnit; // Override for Operator
                unitsInBatch.add(enforcedUnit);
            } else {
                if (teacher.unitKerja) cleanData.unitKerja = teacher.unitKerja;
                else if (teacher.satminkal) cleanData.unitKerja = teacher.satminkal; 
                
                if (cleanData.unitKerja) unitsInBatch.add(cleanData.unitKerja);
            }
            // ------------------

            if (teacher.pendidikanTerakhir) cleanData.pendidikanTerakhir = teacher.pendidikanTerakhir;
            if (teacher.tmt) cleanData.tmt = teacher.tmt;
            if (teacher.kecamatan) cleanData.kecamatan = teacher.kecamatan;
            if (teacher.mapel) cleanData.mapel = teacher.mapel;
            if (teacher.phoneNumber) cleanData.phoneNumber = teacher.phoneNumber;
            if (teacher.email) cleanData.email = teacher.email;
            if (teacher.isCertified !== undefined) cleanData.isCertified = teacher.isCertified;
            if (teacher.isVerified !== undefined) cleanData.isVerified = teacher.isVerified;
            else cleanData.isVerified = false; // Set Unverified to force Approval Flow
            if (teacher.pdpkpnu) cleanData.pdpkpnu = teacher.pdpkpnu;
            if (teacher.draftSk) cleanData.draftSk = teacher.draftSk; 
            if (args.suratPermohonanUrl) cleanData.suratPermohonanUrl = args.suratPermohonanUrl; // Batch File
            
            // Identity
            if (teacher.tempatLahir) cleanData.tempatLahir = teacher.tempatLahir;
            if (teacher.tanggalLahir) cleanData.tanggalLahir = teacher.tanggalLahir;
            if (teacher.nip) cleanData.nip = teacher.nip;
            if (teacher.jenisKelamin) cleanData.jenisKelamin = teacher.jenisKelamin;
            if (teacher.birthPlace) cleanData.tempatLahir = teacher.birthPlace; // Fallback
            if (teacher.birthDate) cleanData.tanggalLahir = teacher.birthDate; // Fallback
            
            // Set Active
            cleanData.isActive = true;

            // Check for duplicate
            const existing = await ctx.db
                .query("teachers")
                .withIndex("by_nuptk", (q) => q.eq("nuptk", cleanData.nuptk))
                .first();
            
            try {
                if (!existing) {
                    const id = await ctx.db.insert("teachers", {
                        ...cleanData,
                        isVerified: true, // FIXED: Bypass Approval Inbox for Bulk Upload
                        isSkGenerated: false, // Ensure visible in Queue
                        createdAt: now,
                        updatedAt: now,
                    });
                    results.push(id);
                } else {
                    // RBAC CHECK FOR EXISTING UPDATE IN BULK
                    if (user.role === 'operator' && existing.unitKerja !== user.unit) {
                        // Skip quietly or error? 
                        // Let's error so they know something is wrong
                        throw new Error("NUPTK owned by another school");
                    }

                    // UPDATE EXISTING RECORD (UPSERT)
                    await ctx.db.patch(existing._id, {
                        ...cleanData,
                        isVerified: true, // FIXED: Bypass Approval Inbox
                        isSkGenerated: false, 
                        updatedAt: now,
                    });
                    results.push(existing._id);
                }
            } catch (err) {
                console.error("Insert/Patch Error:", err);
                results.push(null);
                errors.push(`Error for ${teacher.nama}: ${(err as Error).message}`);
            }
        } catch (err) {
            console.error("Loop Error:", err);
            results.push(null);
            errors.push(`Error for ${teacher.nama || 'Unknown'}: ${(err as Error).message}`);
        }
        }

        // FULL SYNC LOGIC
        // Only allow syncing units user has access to
        let deactivatedCount = 0;
        if (args.isFullSync && unitsInBatch.size > 0) {
            // Foreach Unit involved in this batch
            for (const unit of unitsInBatch) {
                // RBAC Full Sync Protection
                if (user.role === 'operator' && unit !== user.unit) continue;

                try {
                    const teachersInUnit = await ctx.db
                        .query("teachers")
                        .withIndex("by_unit", (q) => q.eq("unitKerja", unit)) 
                        .collect();
                    
                    for (const t of teachersInUnit) {
                        // If teacher is active BUT not in processed list -> Deactivate
                        if (t.isActive && t.nuptk && !processedNuptks.has(t.nuptk)) {
                            // Double check RBAC if existing teacher somehow mismatches (shouldnt happen if by_unit is correct)
                            await ctx.db.patch(t._id, {
                                isActive: false,
                                updatedAt: now
                            });
                            deactivatedCount++;
                        }
                    }
                } catch (err) {
                    console.error("Full Sync Error:", err);
                    errors.push(`Full Sync Warning: Failed to sync unit ${unit}`);
                }
            }
        }
        
        return { 
        count: results.filter(id => id !== null).length, 
        ids: results,
        errors: errors.length > 0 ? errors : undefined,
        deactivated: deactivatedCount,
        version: "4.1 (RBAC Secured)" 
        };
    } catch (criticalError: any) {
        // CATCH GLOBAL CRASHES
        console.error("CRITICAL BULK CREATE ERROR:", criticalError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error(`CRITICAL SERVER ERROR: ${criticalError.message}`);
    }
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
    const user = await validateWriteAccess(ctx, undefined);
    const enforcedUnit = user.role === 'operator' ? user.unit : null;

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
        let unit = t.unitKerja || t.satminkal || t.SATMINKAL || t['Unit Kerja'] || t.sekolah || "";
        
        // RBAC OVERRIDE
        if (enforcedUnit) {
            unit = enforcedUnit;
        }

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
          // RBAC CHECK
          if (user.role === 'operator' && existing.unitKerja !== user.unit) {
              throw new Error("Forbidden: Data belongs to another school");
          }

          // UPSERT (Update)
          await ctx.db.patch(existing._id, cleanData);
          updated++;
        } else {
          // INSERT (New)
          await ctx.db.insert("teachers", {
            ...cleanData,
            isActive: true, // Default active for imports
            createdAt: now,
          });
          success++;
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    };
  },
});

// ============================================================================
// AUTO-NIM GENERATOR
// ============================================================================

export const generateNextNim = query({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch top 50 records sorted by NUPTK descending
    // We fetch 50 to skip over any non-numeric or weird formatted IDs (e.g. "GTY-01")
    const teachers = await ctx.db
      .query("teachers")
      .withIndex("by_nuptk")
      .order("desc")
      .take(50);

    let maxNim = 0;
    
    for (const t of teachers) {
        if (!t.nuptk) continue;
        
        // Remove whitespace
        const val = t.nuptk.trim();
        
        // Check if strictly numeric
        if (/^\d+$/.test(val)) {
            // Check length (assume NIM is at least 6 digits to avoid picking up "1", "2")
            if (val.length >= 6) {
                const num = parseInt(val, 10);
                if (!isNaN(num)) {
                    maxNim = num;
                    break; // Found the highest numeric one
                }
            }
        }
    }

    if (maxNim > 0) {
        return (maxNim + 1).toString();
    } else {
        // Default start if no valid NIM found
        return "113400001"; 
    }
  },
});
