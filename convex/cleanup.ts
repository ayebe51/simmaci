import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const cleanSk = mutation({
  args: {
    deleteTeachers: v.optional(v.boolean()),
    deleteSk: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    console.log("Cleanup script started (SMART CLEANUP)", args);

    let skDeleted = 0;
    let teachersDeleted = 0;

    // 1. DELETE SK HISTORY (If Requested)
    if (args.deleteSk) {
        // LIMIT TO 100 TO PREVENT TIMEOUT
        const docs = await ctx.db.query("skDocuments").take(100);
        for (const doc of docs) {
            await ctx.db.delete(doc._id);
        }
        skDeleted = docs.length;
        
        // Optimize: Only fetch teachers that HAVE generated SK
        const teachers = await ctx.db.query("teachers")
            .filter(q => q.eq(q.field("isSkGenerated"), true))
            .take(100);
            
        for(const t of teachers) {
            await ctx.db.patch(t._id, { isSkGenerated: false });
        }
    }

    // 2. DELETE TEACHER CANDIDATES (If Requested)
    if (args.deleteTeachers) {
        // "Logika sama dengan ketika SK digenerate"
        
        const candidates = await ctx.db
            .query("teachers")
            .filter(q => q.neq(q.field("isSkGenerated"), true)) // TARGET ALL (False OR Undefined)
            .take(100); // LIMIT 100

        for (const t of candidates) {
            // Mimic Generate Logic: Mark as generated (Hidden from queue), set Active/Verified
            await ctx.db.patch(t._id, { 
                isSkGenerated: true, 
                isVerified: true, 
                status: "active" 
            });
        }
        teachersDeleted = candidates.length;
    }

    // 3. Always clean Draft/Unverified junk if just running default (no args)?
    if (!args.deleteTeachers && !args.deleteSk) {
         // Original default behavior: Clear drafts
         const draftTeachers = await ctx.db
            .query("teachers")
            .filter(q => q.eq(q.field("status"), "draft"))
            .take(100); // LIMIT 100
         for (const t of draftTeachers) await ctx.db.delete(t._id);
         teachersDeleted = draftTeachers.length;
    }

    console.log(`Cleanup finished. SK: ${skDeleted}, Teachers: ${teachersDeleted}`);
    return { skDeleted, teachersDeleted };
  },
});
