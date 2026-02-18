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
    // HARDCODE DISABLE DRY RUN FOR CLI EXECUTION
    // const isDryRun = false; 


    for (const [key, group] of groups.entries()) {
        if (group.length > 1) {
            // STRATEGY: Keep the "Best" record
            // 1. Sort by NUPTK presence (Valid NUPTK first)
            // 2. Then by Certification (Certified first)
            // 3. Then by UpdatedAt (Newest first)
            group.sort((a, b) => {
                const aHasNuptk = a.nuptk && a.nuptk.length > 5 && !a.nuptk.toLowerCase().includes("tmp");
                const bHasNuptk = b.nuptk && b.nuptk.length > 5 && !b.nuptk.toLowerCase().includes("tmp");
                
                if (aHasNuptk && !bHasNuptk) return -1; // a comes first (keep)
                if (!aHasNuptk && bHasNuptk) return 1;  // b comes first (keep)
                
                // If both or neither have NUPTK, check certification
                if (a.isCertified && !b.isCertified) return -1;
                if (!a.isCertified && b.isCertified) return 1;

                // Finally newest update wins
                return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
            
            const [keep, ...remove] = group;
            kept++; // We keep the first one
            
            if (!isDryRun) {
                for (const r of remove) {
                    await ctx.db.delete(r._id);
                    removed++;
                }
            } else {
                removed += remove.length;
                report.push(`[Mock Delete] would remove ${remove.length} dupes for '${keep.nama}'. Keeping ID: ${keep._id} (NUPTK: ${keep.nuptk})`);
            }
            
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
// Hard delete drafts (cleanSk)
export const cleanSk = mutation({
  args: {
    targetSchoolId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const drafts = await ctx.db
        .query("skDocuments")
        .withIndex("by_status", q => q.eq("status", "draft"))
        .collect();
    
    let deleted = 0;
    for (const d of drafts) {
        await ctx.db.delete(d._id);
        deleted++;
    }
    
    return { draftsDeleted: deleted };
  }
});
