import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const deduplicateTeachers = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    targetSchoolId: v.optional(v.string()) // Optional: target specific school/unit
  },
  handler: async (ctx, args) => {
    const teachers = await ctx.db.query("teachers").collect();
    
    // Group by unique key (NUPTK or Name + School)
    const groups = new Map<string, any[]>();
    
    // Relaxed Key: Name + (Unit OR School)
    // Ignore NUPTK for matching, as duplicates often have empty/wrong NUPTK
    for (const t of teachers) {
        let location = t.unitKerja || "NOUNIT";
        if (t.schoolId) location = t.schoolId; // Prefer ID if available
        
        // Normalize
        const nameKey = t.nama.trim().toLowerCase().replace(/[^a-z0-9]/g, ""); // aggressive normalize
        const locKey = location.trim().toLowerCase();
        
        const key = `${nameKey}|${locKey}`;
        
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(t);
    }

    let removed = 0;
    let kept = 0;
    const report = [];

    const isDryRun = args.dryRun ?? false; // LIVE RUN ENABLED

    for (const [key, group] of groups.entries()) {
        if (group.length > 1) {
            // Sort by updatedAt desc (keep newest)
            group.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            
            const [keep, ...remove] = group;
            kept++;
            
            if (!isDryRun) {
                for (const r of remove) {
                    await ctx.db.delete(r._id);
                    removed++;
                }
            } else {
                removed += remove.length; // Count hypothetical removals
            }
            
            report.push(`Duplicate: ${keep.nama} (${group.length} copies). Kept ID: ${keep._id}, Removing: ${remove.length}`);
        } else {
            kept++;
        }
    }

    return {
        total_scanned: teachers.length,
        unique_groups: groups.size,
        duplicates_removed: removed,
        dry_run: !!isDryRun,
        // DUMP DATA FOR DEBUG
        cimanggu_dump: teachers.filter(t => (t.unitKerja || "").toLowerCase().includes("cimanggu")).map(t => `${t.nama} | ${t.unitKerja} | ${t.nuptk}`)
    };
  }
});
