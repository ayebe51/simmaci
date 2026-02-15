import { query, mutation, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
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
        // 🔥 DEBUG BYPASS
        if (args.unitKerja === "DEBUG_ALL") {
             // Bypass index to see EVERYTHING
            return await ctx.db.query("teachers").collect();
        }

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
             throw new ConvexError("Unauthorized: Sesi tidak valid atau kadaluarsa.");
        }
    } else {
        // 1. Standard Convex Auth
        const identity = await ctx.auth.getUserIdentity();
        
        // 1. If not logged in, throw error (Strict Mode)
        if (!identity) {
            throw new ConvexError("Unauthorized: Harap login terlebih dahulu.");
        }

        user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();
    }

    if (!user) {
        throw new ConvexError("Unauthorized: User tidak ditemukan.");
    }

    // 2. Admin is God Mode (Support both 'admin' and 'super_admin')
    if (user.role === 'admin' || user.role === 'super_admin') {
        return user; // Pass
    }

    // 3. Operator Logic
    if (user.role === 'operator') {
        // NEW: School ID Check (Priority)
        if (user.schoolId) {
             // A. If acting on existing teacher, check schoolId match
             if (currentTeacherId) {
                const existing = await ctx.db.get(currentTeacherId);
                if (!existing) return user;
                
                // Strict School ID Match
                if (existing.schoolId && existing.schoolId !== user.schoolId) {
                     throw new ConvexError(`Forbidden: Anda tidak memiliki akses ke guru ini. (School ID: ${existing.schoolId} vs ${user.schoolId})`);
                }

                // Fallback for legacy data (no schoolId on teacher) -> Check Unit Name
                if (!existing.schoolId) {
                    const existingUnit = existing.unitKerja?.trim().toLowerCase() || "";
                    const userUnit = user.unit?.trim().toLowerCase() || "";
                    if (existingUnit !== userUnit) {
                         throw new ConvexError(`Forbidden: Satminkal tidak cocok. Teacher: ${existingUnit}, User: ${userUnit}`);
                    }
                }
             }
             return user;
        }

        // FALLBACK: Legacy String Logic
        if (!user.unit) {
            throw new ConvexError("Forbidden: Akun operator tidak memiliki Unit Kerja.");
        }

        const userUnitNormalized = user.unit.trim().toLowerCase();

        // A. If targetUnit is provided (Create/Update), it MUST match user.unit
        if (targetUnit && targetUnit.trim().toLowerCase() !== userUnitNormalized) {
            throw new ConvexError(`Forbidden: Anda tidak berhak mengelola data unit '${targetUnit}'.`);
        }

        // B. If acting on existing teacher (Update/Delete), verify ownership
        if (currentTeacherId) {
            const existing = await ctx.db.get(currentTeacherId);
            if (!existing) return user; // Let the mutation handle "not found"
            
            if (existing.unitKerja?.trim().toLowerCase() !== userUnitNormalized) {
                 throw new ConvexError("Forbidden: Anda tidak memiliki akses ke guru ini.");
            }
        }

        return user;
    }

    throw new ConvexError("Forbidden: Role tidak dikenali.");
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
    token: v.optional(v.string()), // Auth Token
    schoolId: v.optional(v.id("schools")), // Optional direct set for Super Admin
  },
  handler: async (ctx, args) => {
    try {
        console.log("Mutation teachers:create called with args:", args);
        
        // RBAC CHECK
        const user = await validateWriteAccess(ctx, args.unitKerja, undefined, args.token);
        console.log("User validated:", user?.name, user?.role);
        
        // For Operators, FORCE unitKerja to match their account (Double Safety)
        const finalUnit = user.role === 'operator' ? user.unit : args.unitKerja;
        // NEW: Force schoolId if user has it
        const finalSchoolId = user.role === 'operator' ? user.schoolId : (args as any).schoolId; 
        
        // ... (rest of the logic remains similar but simplified error handling)
        
        const now = Date.now();
        
        // Check for duplicate NUPTK
        let existing = await ctx.db
          .query("teachers")
          .withIndex("by_nuptk", (q) => q.eq("nuptk", args.nuptk))
          .first();

        // FALLBACK: If Not Found by NUPTK, Check by Name + Unit (Fuzzy Match)
        // Only if NUPTK is likely invalid/placeholder or strictly to prevent double-entry of same name in same unit
        if (!existing) {
             // 1. Check if NUPTK is "dummy" (optional, but good practice). For now, always check name collision in unit.
             const candidates = await ctx.db
                .query("teachers")
                .withIndex("by_unit", (q) => q.eq("unitKerja", finalUnit))
                .collect();
             
             // Fuzzy Name Match
             existing = candidates.find(t => t.nama.trim().toLowerCase() === args.nama.trim().toLowerCase()) || null;
             
             if (existing) {
                 console.log(`[Duplicate Check] Found by Name+Unit: ${existing.nama} (${finalUnit})`);
             }
        }
        
        // Destructure token out of args so it's not written to DB
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { token, ...teacherData } = args;

        if (existing) {
          console.log("Existing teacher found:", existing._id);
          // RBAC CHECK FOR UPDATE
          if (user.role === 'operator' && existing.unitKerja !== user.unit) {
              throw new ConvexError("Forbidden: NUPTK terdaftar di sekolah lain.");
          }

          // UPSERT LOGIC
          console.log(`Update Existing Teacher: ${args.nama} (${args.nuptk})`);
          await ctx.db.patch(existing._id, {
            ...teacherData,
            unitKerja: finalUnit,
            updatedAt: now,
            isSkGenerated: false, // RESET FLAG: Ensure teacher appears in Generator Queue
          });
          return existing._id;
        }
        
        console.log("Inserting new teacher...");
        const newIds = await ctx.db.insert("teachers", {
          ...teacherData,
          unitKerja: finalUnit,
          schoolId: finalSchoolId,
          isActive: args.isActive ?? true,
          isSkGenerated: false, // Explicitly set to false
          createdAt: now,
          updatedAt: now,
        });
        console.log("Insert success:", newIds);
        return newIds;
    } catch (e: any) {
        if (e instanceof ConvexError) throw e;
        console.error("FAIL in teachers:create :", e);
        throw new ConvexError(`Server Error: ${e.message}`);
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
    token: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")), // Optional update
    // Support Legacy/Lowercase fields from older frontends
    tanggallahir: v.optional(v.string()), 
    tempatlahir: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    console.log("---------------------------------------------------");
    console.log("Mutation teachers:update START");
    console.log("Args:", JSON.stringify(args));
    
    try {
        const { id, token, ...updates } = args;

        // LEGACY MAPPING: Handle lowercase fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalUpdates: any = { ...updates };
        if ((args as any).tanggallahir) finalUpdates.tanggalLahir = (args as any).tanggallahir;
        if ((args as any).tempatlahir) finalUpdates.tempatLahir = (args as any).tempatlahir;

        console.log("1. Validating Write Access...");
        console.log("   - Unit:", finalUpdates.unitKerja);
        console.log("   - ID:", id);
        
        // RBAC CHECK - Let ConvexError bubble up
        const user = await validateWriteAccess(ctx, finalUpdates.unitKerja, id, token);
        console.log("2. Access Validated.");

        // PROTECT SCHOOL ID
        if (user.role === 'operator') {
            delete finalUpdates.schoolId; // Operator cannot move teachers between schools
            delete finalUpdates.unitKerja; // Operator cannot rename unit
        }
        
        console.log("3. Patching DB...");
        await ctx.db.patch(id, {
          ...finalUpdates,
          updatedAt: Date.now(),
        });
        console.log("4. Patch Success.");
        return id;
    } catch (e: any) {
        if (e instanceof ConvexError) throw e;
        console.error("FAIL in teachers:update :", e);
        throw new ConvexError(`Update Failed: ${e.message}`);
    }
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

// Bulk create teachers (for import) - ULTRA FLEXIBLE & ROBUST VERSION
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
        const enforcedSchoolId = user.role === 'operator' ? user.schoolId : null; 

        // PRE-PROCESSING: Normalize Input & Identify Units
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanInputs: any[] = [];
        const normalizedUnitMap = new Map<string, string>(); // normalized -> original db unit

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

        // Normalizer for Fuzzy Matching
        const normalize = (str: string | undefined) => {
            if (!str) return "";
            return str.toLowerCase().replace(/[^a-z0-9]/g, ""); // Remove punctuation, spaces
        }

        for (const teacher of args.teachers) {
             if (!teacher) continue;
             
             // 1. Mandatory Fields
             const rawNuptk = safeString(teacher.nuptk || teacher.NUPTK);
             const rawNama = safeString(teacher.nama || teacher.NAMA || teacher.Name);

             if (!rawNuptk || !rawNama) {
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
                 isSkGenerated: false,
             };
             
             // 3. Status & Activity
             cleanData.status = safeString(teacher.status || teacher.STATUS) || "active"; 
             cleanData.isActive = true; 

             // 4. Unit Logic
             if (enforcedUnit) {
                 cleanData.unitKerja = enforcedUnit; 
                 unitsInBatch.add(enforcedUnit);
             } else {
                 const rawUnit = safeString(teacher.unitKerja || teacher.UnitKerja || teacher.satminkal);
                 if (rawUnit) {
                     cleanData.unitKerja = rawUnit;
                     unitsInBatch.add(rawUnit);
                 }
             }

             // School ID Logic
             if (enforcedSchoolId) cleanData.schoolId = enforcedSchoolId;
             else if (teacher.schoolId) cleanData.schoolId = teacher.schoolId;

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
             mapField(teacher.tempatLahir || teacher.birthPlace, 'tempatLahir');
             mapField(teacher.tanggalLahir || teacher.birthDate, 'tanggalLahir');
             mapField(teacher.nip || teacher.NIP, 'nip');
             mapField(teacher.jenisKelamin || teacher.jk, 'jenisKelamin');
             
             const isCertified = safeBool(teacher.isCertified || teacher.sertifikasi);
             if (isCertified !== undefined) cleanData.isCertified = isCertified;

             const isVerified = safeBool(teacher.isVerified);
             if (isVerified !== undefined) cleanData.isVerified = isVerified;
             else cleanData.isVerified = true; 

             if (args.suratPermohonanUrl) cleanData.suratPermohonanUrl = args.suratPermohonanUrl;

             cleanInputs.push(cleanData);
        }

        // OPTIMIZATION: Prefetch Existing Teachers in Batch Units
        console.log(`Prefetching teachers for units: ${Array.from(unitsInBatch).join(", ")}`);
        
        // Multi-level Lookup:
        // 1. NUPTK -> Teacher (Direct DB Match)
        // 2. Unit(Norm):Name(Norm) -> Teacher (Fuzzy Match)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fuzzyLookup = new Map<string, any>(); 
        
        for (const unit of unitsInBatch) {
            const unitTeachers = await ctx.db
                .query("teachers")
                .withIndex("by_unit", (q) => q.eq("unitKerja", unit))
                .collect();
            
            const normUnit = normalize(unit);
            
            for (const t of unitTeachers) {
                const key = `${normUnit}:${normalize(t.nama)}`;
                fuzzyLookup.set(key, t);
                 // Also map NUPTK just in case logic needs it locally, 
                 // though we'll check DB by NUPTK row-by-row safely via indexed query if needed, 
                 // but prefetching everything is safer for bulk checks.
            }
        }

        // PROCESS BATCH
        for (const cleanData of cleanInputs) {
             try {
                 // STRATEGY:
                 // 1. Check Exact NUPTK (Highest Confidence)
                 let existing = await ctx.db
                     .query("teachers")
                     .withIndex("by_nuptk", (q) => q.eq("nuptk", cleanData.nuptk))
                     .first();

                 // 2. Fallback: Fuzzy Name + Unit
                 if (!existing && cleanData.unitKerja) {
                     const key = `${normalize(cleanData.unitKerja)}:${normalize(cleanData.nama)}`;
                     const fuzzyMatch = fuzzyLookup.get(key);
                     
                     if (fuzzyMatch) {
                         console.log(`[Bulk Dedup] Fuzzy match found! '${cleanData.nama}' matched '${fuzzyMatch.nama}'`);
                         existing = fuzzyMatch;
                     }
                 }

                 if (!existing) {
                     cleanData.createdAt = now;
                     const id = await ctx.db.insert("teachers", cleanData);
                     results.push(id);
                 } else {
                     // Update Existing
                     // RBAC Safety
                     if (user.role === 'operator') {
                          const existingUnit = existing.unitKerja?.trim().toLowerCase() || "";
                          const userUnit = user.unit?.trim().toLowerCase() || "";
                          if (existingUnit && existingUnit !== userUnit) {
                              errors.push(`Skipped ${cleanData.nama}: Registered in another unit (${existing.unitKerja})`);
                              results.push(null);
                              continue;
                          }
                     }
                     
                     // Patch
                     await ctx.db.patch(existing._id, {
                         ...cleanData,
                         // Preserve crucial original fields if needed, but update allows overwrites
                     });
                     results.push(existing._id);
                 }

             } catch (err: any) {
                 console.error(`Row Error (${cleanData.nama}):`, err);
                 results.push(null);
                 errors.push(`Error for ${cleanData.nama}: ${err.message}`);
             }
        }

        // FULL SYNC LOGIC (Deactivate missing)
        let deactivatedCount = 0;
        if (args.isFullSync && unitsInBatch.size > 0) {
            for (const unit of unitsInBatch) {
                if (user.role === 'operator' && unit !== user.unit) continue;
                
                // Re-fetch to be safe or reuse? Re-fetch safer for transaction consistency?
                // Convex mutations are transactional, so we can reuse if we updated the map, 
                // but we didn't update the map during the loop. 
                // Let's just fetch active ones to be safe.
                const teachersInUnit = await ctx.db
                    .query("teachers")
                    .withIndex("by_unit", (q) => q.eq("unitKerja", unit)) 
                    .collect();
                
                for (const t of teachersInUnit) {
                    if (t.isActive && t.nuptk && !processedNuptks.has(t.nuptk)) {
                         // Check if this teacher was JUST updated (handled in the loop but NUPTK might differ?)
                         // processedNuptks tracks the INPUT NUPTKs. 
                         // If existing teacher has NUPTK 'A' but input had 'B' (and fuzzy matched), 
                         // we updated teacher 'A' to have NUPTK 'B'.
                         // So 'A' is no longer in DB effectively (it's 'B'). 
                         // But we iterate 'teachersInUnit' which is SNAPSHOT at start? 
                         // Convex mutations read-your-writes? Yes.
                         // So query here will see updated NUPTKs.
                         
                         // Wait, if we updated a teacher, their NUPTK in DB is now cleanData.nuptk (which IS in processedNuptks).
                         // So this logic holds.
                         
                        await ctx.db.patch(t._id, {
                            isActive: false,
                            updatedAt: now
                        });
                        deactivatedCount++;
                    }
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
    unitKerja: v.optional(v.string()), // Deprecated
    schoolId: v.optional(v.id("schools")), // New
    kecamatan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Optimized Path: Filter by School ID if present
    if (args.schoolId) {
        const teachers = await ctx.db
            .query("teachers")
            .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId)) // Needs Index!
            .collect();
        // Post-filter for active status if needed, though index should ideally cover it
        return teachers.filter(t => t.isActive !== false).length;
    }

    // Fallback Path (Legacy)
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
    const enforcedSchoolId = user.role === 'operator' ? user.schoolId : null; // NEW: Capture School ID

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
        
        const cleanData: any = {
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
          isSkGenerated: false, // RESET FLAG
        };

        // NEW: School ID Logic
        if (enforcedSchoolId) {
             cleanData.schoolId = enforcedSchoolId;
        } else if (t.schoolId) {
             cleanData.schoolId = t.schoolId;
        }

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
