import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const backfillSchoolIds = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? true;
    console.log(`MIGRATION START (Dry Run: ${isDryRun})`);

    // 1. Load all schools for lookup
    const schools = await ctx.db.query("schools").collect();
    const schoolMap = new Map<string, string>(); // Name -> ID
    
    // Normalize helper
    const norm = (s: string) => s.toLowerCase().trim().replace(/['`]/g, "");

    for (const s of schools) {
        schoolMap.set(norm(s.nama), s._id);
        // Also map by NSM if needed? converting name is safer for now as unitKerja is name based.
    }

    console.log(`Loaded ${schools.length} schools for lookup.`);

    // 2. Migrate Teachers
    let teacherUpdated = 0;
    let teacherSkipped = 0;
    let teacherFailed = 0;

    const teachers = await ctx.db.query("teachers").collect();
    
    for (const t of teachers) {
        if (t.schoolId) {
            teacherSkipped++;
            continue; 
        }

        if (!t.unitKerja) {
             teacherFailed++;
             continue;
        }

        const schoolId = schoolMap.get(norm(t.unitKerja));
        
        if (schoolId) {
            if (!isDryRun) {
                await ctx.db.patch(t._id, { schoolId: schoolId as any });
            }
            teacherUpdated++;
        } else {
            console.warn(`[Teacher] Failed to match unitKerja: "${t.unitKerja}" for ${t.nama}`);
            teacherFailed++;
        }
    }

    console.log(`TEACHERS: Updated ${teacherUpdated}, Skipped ${teacherSkipped}, Failed ${teacherFailed}`);

    // 3. Migrate Users
    let userUpdated = 0;
    let userSkipped = 0;
    let userFailed = 0;

    const users = await ctx.db.query("users").collect();

    for (const u of users) {
        if (u.schoolId) {
            userSkipped++;
            continue;
        }

        // Only migrate operators who have a unit
        if (u.role !== 'operator' || !u.unit) {
            userSkipped++; // Admin doesn't need schoolId usually, or logic differs
            continue;
        }

        const schoolId = schoolMap.get(norm(u.unit));
        
        if (schoolId) {
             if (!isDryRun) {
                await ctx.db.patch(u._id, { schoolId: schoolId as any });
            }
            userUpdated++;
        } else {
            console.warn(`[User] Failed to match unit: "${u.unit}" for ${u.name}`);
            userFailed++;
        }
    }

    console.log(`USERS: Updated ${userUpdated}, Skipped ${userSkipped}, Failed ${userFailed}`);
    
    return {
        success: true,
        teachers: { updated: teacherUpdated, failed: teacherFailed },
        users: { updated: userUpdated, failed: userFailed }
    };
  },
});
