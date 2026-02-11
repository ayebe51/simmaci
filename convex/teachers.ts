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
// --- RBAC HELPER ---
async function validateWriteAccess(ctx: MutationCtx, targetUnit: string | undefined, currentTeacherId?: Id<"teachers">, token?: string) {
    let user = null;

    // 0. Try Token Auth First (for custom sessions)
    if (token) {
        user = await validateSession(ctx, token);
        if (!user) {
             throw new Error("Unauthorized: Sesi tidak valid atau kadaluarsa.");
        }
    } else {
        // 1. Standard Convex Auth
        const identity = await ctx.auth.getUserIdentity();
        
        // 1. If not logged in, throw error (Strict Mode)
        if (!identity) {
            throw new Error("Unauthorized: Harap login terlebih dahulu.");
        }

        user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();
    }

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
    try {
        console.log("Mutation teachers:create called with args:", args);
        
        // RBAC CHECK
        const user = await validateWriteAccess(ctx, args.unitKerja);
        console.log("User validated:", user?.name, user?.role);
        
        // For Operators, FORCE unitKerja to match their account (Double Safety)
        const finalUnit = user.role === 'operator' ? user.unit : args.unitKerja;

        const now = Date.now();
        
        // Check for duplicate NUPTK
        const existing = await ctx.db
          .query("teachers")
          .withIndex("by_nuptk", (q) => q.eq("nuptk", args.nuptk))
          .first();
        
        if (existing) {
          console.log("Existing teacher found:", existing._id);
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
        
        console.log("Inserting new teacher...");
        const newIds = await ctx.db.insert("teachers", {
          ...args,
          unitKerja: finalUnit, // Ensure secure unit
          isActive: args.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        });
        console.log("Insert success:", newIds);
        return newIds;
    } catch (e: any) {
        console.error("FAIL in teachers:create :", e);
        // Throw a clean error that clients can display
        throw new Error(`Server Error: ${e.message}`);
    }
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
    teachers: v.array(v.any()), // We accept ANY structure and sanitize it inside
    isFullSync: v.optional(v.boolean()), // Enable Full Sync Mode
    suratPermohonanUrl: v.optional(v.string()), // Batch Request File
    token: v.optional(v.string()), // Authentication Token
  },
  handler: async (ctx, args) => {
    // RESTORED AUTH
    const user = await validateWriteAccess(ctx, undefined, undefined, args.token);

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
            
            // Helper to safe cast to string or undefined
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const safeString = (val: any): string | undefined => {
                if (val === null || val === undefined || val === "") return undefined;
                return String(val).trim();
            }

            // Helper to safe cast to boolean
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const safeBool = (val: any): boolean | undefined => {
                if (val === true || val === "true" || val === "ya" || val === "Ya") return true;
                if (val === false || val === "false" || val === "tidak" || val === "Tidak") return false;
                return undefined;
            }
            
            try {
                // 1. Mandatory Fields
                const rawNuptk = safeString(teacher.nuptk || teacher.NUPTK);
                const rawNama = safeString(teacher.nama || teacher.NAMA || teacher.Name);

                if (!rawNuptk || !rawNama) {
                    results.push(null);
                    errors.push(`Missing NUPTK or Name for row: ${JSON.stringify(teacher).substring(0, 50)}...`);
                    continue;
                }
                
                processedNuptks.add(rawNuptk);

                // 2. Prepare Clean Data
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cleanData: any = {
                    nuptk: rawNuptk,
                    nama: rawNama,
                    updatedAt: now,
                };
                
                // 3. Status & Activity
                cleanData.status = safeString(teacher.status || teacher.STATUS) || "active"; 
                cleanData.isActive = true; // Force active on import

                // 4. Unit Logic
                if (enforcedUnit) {
                    cleanData.unitKerja = enforcedUnit; // Override for Operator
                    unitsInBatch.add(enforcedUnit);
                } else {
                    const rawUnit = safeString(teacher.unitKerja || teacher.UnitKerja || teacher.satminkal);
                    if (rawUnit) {
                        cleanData.unitKerja = rawUnit;
                        unitsInBatch.add(rawUnit);
                    }
                }

                // 5. Optional Fields Mapping
                const mapField = (source: any, targetKey: string) => {
                    const val = safeString(source);
                    if (val !== undefined) cleanData[targetKey] = val;
                };

                mapField(teacher.pendidikanTerakhir || teacher.pendidikan, 'pendidikanTerakhir');
                mapField(teacher.tmt || teacher.TMT, 'tmt');
                mapField(teacher.kecamatan || teacher.Kecamatan, 'kecamatan');
                mapField(teacher.mapel || teacher.Mapel, 'mapel');
                mapField(teacher.phoneNumber || teacher.hp, 'phoneNumber');
                mapField(teacher.email, 'email');
                mapField(teacher.pdpkpnu, 'pdpkpnu');
                
                // Identity
                mapField(teacher.tempatLahir || teacher.birthPlace, 'tempatLahir');
                mapField(teacher.tanggalLahir || teacher.birthDate, 'tanggalLahir');
                mapField(teacher.nip || teacher.NIP, 'nip');
                mapField(teacher.jenisKelamin || teacher.jk, 'jenisKelamin');
                
                // Booleans
                const isCertified = safeBool(teacher.isCertified || teacher.sertifikasi);
                if (isCertified !== undefined) cleanData.isCertified = isCertified;

                const isVerified = safeBool(teacher.isVerified);
                if (isVerified !== undefined) cleanData.isVerified = isVerified;
                else cleanData.isVerified = true; // Auto-verify imports

                cleanData.isSkGenerated = false;

                if (args.suratPermohonanUrl) cleanData.suratPermohonanUrl = args.suratPermohonanUrl;

                // 6. DB Operations
                const existing = await ctx.db
                    .query("teachers")
                    .withIndex("by_nuptk", (q) => q.eq("nuptk", cleanData.nuptk))
                    .first();
                
                if (!existing) {
                    cleanData.createdAt = now;
                    const id = await ctx.db.insert("teachers", cleanData);
                    results.push(id);
                } else {
                    // RBAC CHECK
                    if (user.role === 'operator') {
                        const existingUnit = existing.unitKerja?.trim().toLowerCase() || "";
                        const userUnit = user.unit?.trim().toLowerCase() || "";
                        
                        // Strict check by ID or Name
                        if (existingUnit !== userUnit) {
                            throw new Error(`NUPTK ${cleanData.nuptk} terdaftar di unit lain (${existing.unitKerja}).`);
                        }
                    }

                    await ctx.db.patch(existing._id, cleanData);
                    results.push(existing._id);
                }

            } catch (err: any) {
                console.error(`Row Error (${teacher.nama}):`, err);
                results.push(null);
                errors.push(`Error for ${teacher.nama || 'Unknown'}: ${err.message}`);
            }
        }

        // FULL SYNC LOGIC (Unchanged but safer)
        let deactivatedCount = 0;
        if (args.isFullSync && unitsInBatch.size > 0) {
            for (const unit of unitsInBatch) {
                if (user.role === 'operator' && unit !== user.unit) continue;

                try {
                    const teachersInUnit = await ctx.db
                        .query("teachers")
                        .withIndex("by_unit", (q) => q.eq("unitKerja", unit)) 
                        .collect();
                    
                    for (const t of teachersInUnit) {
                        if (t.isActive && t.nuptk && !processedNuptks.has(t.nuptk)) {
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
            version: "4.2 (Robust Type Safe)" 
        };

    } catch (criticalError: any) {
        console.error("CRITICAL BULK CREATE ERROR:", criticalError);
        // Return structured error so UI handles it instead of crashing
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
