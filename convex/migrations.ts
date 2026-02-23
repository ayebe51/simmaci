import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const backfillSchoolIds = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? false; // Default to FALSE for execution
    console.log(`MIGRATION START (Dry Run: ${isDryRun})`);

    // 1. Load all schools for lookup
    const schools = await ctx.db.query("schools").collect();
    const schoolMap = new Map<string, string>(); // Name -> ID
    
    // Normalize helper
    const norm = (s: string) => s ? s.toLowerCase().trim().replace(/['`]/g, "") : "";

    for (const s of schools) {
        schoolMap.set(norm(s.nama), s._id);
        // Map NSM too
        if (s.nsm) schoolMap.set(s.nsm, s._id); 
    }

    console.log(`Loaded ${schools.length} schools for lookup.`);

    // 2. Migrate SK Documents
    let skUpdated = 0;
    let skSkipped = 0;
    let skFailed = 0;

    const skDocs = await ctx.db.query("skDocuments").collect();
    
    for (const sk of skDocs) {
        if (sk.schoolId) {
            skSkipped++;
            continue; 
        }

        if (!sk.unitKerja) {
             skFailed++;
             continue;
        }

        const schoolId = schoolMap.get(norm(sk.unitKerja));
        
        if (schoolId) {
            if (!isDryRun) {
                // Cast to any to avoid type check issues if types aren't fully synced yet
                await ctx.db.patch(sk._id, { schoolId: schoolId as any });
            }
            skUpdated++;
        } else {
            console.warn(`[SK] Failed to match unitKerja: "${sk.unitKerja}" for SK ${sk.nomorSk}`);
            skFailed++;
        }
    }

    console.log(`SKDOCS: Updated ${skUpdated}, Skipped ${skSkipped}, Failed ${skFailed}`);

    // 3. Migrate Users (Operators)
    let userUpdated = 0;
    let userSkipped = 0;
    let userFailed = 0;

    const users = await ctx.db.query("users").collect();

    for (const u of users) {
        if (u.schoolId) {
            userSkipped++;
            continue;
        }

        if (u.role !== 'operator' || !u.unit) {
            userSkipped++; 
            continue;
        }

        const schoolId = schoolMap.get(norm(u.unit));
        
        if (schoolId) {
             if (!isDryRun) {
                await ctx.db.patch(u._id, { schoolId: schoolId as any });
            }
            userUpdated++;
        } else {
            // Check lookup again with raw unit (maybe it's NSM)
            const nsmMatch = schoolMap.get(u.unit);
            if (nsmMatch) {
                 if (!isDryRun) {
                    await ctx.db.patch(u._id, { schoolId: nsmMatch as any });
                }
                userUpdated++;
            } else {
                console.warn(`[User] Failed to match unit: "${u.unit}" for ${u.name}`);
                userFailed++;
            }
        }
    }

    console.log(`USERS: Updated ${userUpdated}, Skipped ${userSkipped}, Failed ${userFailed}`);
    
    return {
        success: true,
        skDocs: { updated: skUpdated, failed: skFailed },
        users: { updated: userUpdated, failed: userFailed }
    };
  },
});

export const bootstrapSchools = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Default to FALSE for execution (since I am running this deliberately)
    const isDryRun = args.dryRun ?? false; 
    console.log(`BOOTSTRAP SCHOOLS (Dry Run: ${isDryRun})`);
    
    const uniqueSchools = new Set<string>();

    // ... (rest of scan logic same) ...

    // 1. Scan Teachers
    const teachers = await ctx.db.query("teachers").collect();
    teachers.forEach(t => {
        if (t.unitKerja) uniqueSchools.add(t.unitKerja.trim());
    });

    // 2. Scan Users
    const users = await ctx.db.query("users").collect();
    users.forEach(u => {
        if (u.role === 'operator' && u.unit) uniqueSchools.add(u.unit.trim());
    });

    // 3. Scan SKs
    const sks = await ctx.db.query("skDocuments").collect();
    sks.forEach(sk => {
        if (sk.unitKerja) uniqueSchools.add(sk.unitKerja.trim());
    });
    
    console.log(`Found ${uniqueSchools.size} unique school names.`);
    
    const results = [];

    for (const schoolName of uniqueSchools) {
        // Skip if exists
        const existing = await ctx.db
            .query("schools")
            .filter(q => q.eq(q.field("nama"), schoolName))
            .first();

        if (!existing) {
            console.log(`Creating School: ${schoolName}`);
            if (!isDryRun) {
                const nsm = `TEMP-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                
                await ctx.db.insert("schools", {
                    nama: schoolName,
                    nsm: nsm,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    kecamatan: "Unknown"
                });
            }
            results.push(schoolName);
        } else {
            // console.log(`Skipping existing: ${schoolName}`);
        }
    }

    return { created: results.length, names: results, dryRun: isDryRun };
  }
});

/**
 * Migration: syncTeachersWithSchools
 * Links teachers to schools via schoolId and standardizes kecamatan data.
 */
export const syncTeachersWithSchools = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? false;
    console.log(`MIGRATION: syncTeachersWithSchools START (Dry Run: ${isDryRun})`);

    // 1. Load Schools lookup map
    const schools = await ctx.db.query("schools").collect();
    const schoolMap = new Map<string, { id: string; kecamatan: string }>();

    const norm = (s: string) => (s || "").toLowerCase().trim().replace(/['`]/g, "");

    for (const s of schools) {
      const key = norm(s.nama);
      if (key) {
        schoolMap.set(key, { id: s._id, kecamatan: s.kecamatan || "Unknown" });
      }
      if (s.nsm) {
        schoolMap.set(s.nsm, { id: s._id, kecamatan: s.kecamatan || "Unknown" });
      }
    }

    console.log(`Loaded ${schools.length} schools for sync.`);

    // 2. Load Teachers
    const teachers = await ctx.db.query("teachers").collect();
    let updated = 0;
    let failedToMatch = 0;
    let skipped = 0;

    for (const t of teachers) {
      let targetId = t.schoolId;
      let schoolData = null;

      // Try to find school by name if ID is missing
      if (!targetId && t.unitKerja) {
        schoolData = schoolMap.get(norm(t.unitKerja));
        if (schoolData) targetId = schoolData.id as any;
      }

      // If we have an ID (either existing or found), verify/get school data
      if (targetId) {
        if (!schoolData) {
            // Find school data by ID in our map (INEFFICIENT but map is small)
            schoolData = Array.from(schoolMap.values()).find(v => v.id === targetId);
        }

        const patch: any = {};
        if (!t.schoolId) patch.schoolId = targetId;

        // Sync Kecamatan if missing, "Unknown", or mismatching the school
        const currentKec = (t.kecamatan || "").trim();
        const schoolKec = schoolData?.kecamatan || "Unknown";

        if (!currentKec || currentKec === "Unknown" || currentKec === "Tidak Diketahui" || (schoolKec !== "Unknown" && currentKec !== schoolKec)) {
            patch.kecamatan = schoolKec;
        }

        if (Object.keys(patch).length > 0) {
          if (!isDryRun) {
            await ctx.db.patch(t._id, patch);
          }
          updated++;
        } else {
          skipped++;
        }
      } else {
        failedToMatch++;
      }
    }

    console.log(`MIGRATION DONE: Updated: ${updated}, Skipped: ${skipped}, Failed: ${failedToMatch}`);
    return { updated, skipped, failedToMatch };
  },
});

/**
 * Migration: capitalizeExistingTeacherNames
 * Converts ALL existing teacher names to UPPERCASE.
 */
export const capitalizeExistingTeacherNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    let updated = 0;

    for (const t of teachers) {
      const upperName = (t.nama || "").trim().toUpperCase();
      if (t.nama !== upperName) {
        await ctx.db.patch(t._id, { nama: upperName });
        updated++;
      }
    }

    console.log(`MIGRATION DONE: Capitalized ${updated} teacher names.`);
    return { updated };
  },
});
