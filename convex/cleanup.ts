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
        const docs = await ctx.db.query("skDocuments").collect();
        for (const doc of docs) {
            await ctx.db.delete(doc._id);
        }
        skDeleted = docs.length;
        
        // Optimize: Only fetch teachers that HAVE generated SK
        const teachers = await ctx.db.query("teachers")
            .filter(q => q.eq(q.field("isSkGenerated"), true))
            .collect();
            
        for(const t of teachers) {
            await ctx.db.patch(t._id, { isSkGenerated: false });
        }
    }

    // 2. DELETE TEACHER CANDIDATES (If Requested)
    if (args.deleteTeachers) {
        // Delete "Draft" AND "Active" candidates that have NOT generated SK yet
        // OR simply delete ALL teachers in the list if they are not "Permanent Master"?
        // Since we don't have a specific flag for "Bulk Upload", we rely on the user's intent to clear
        // the "Generator Page".
        // The generator page usually shows teachers who match certain criteria.
        // SAFEGUARD: Delete only those who are NOT verified? No, bulk upload is verified.
        
        // Let's delete teachers created recently? No.
        // Let's delete teachers who are NOT skGenerated.
        const candidates = await ctx.db
            .query("teachers")
            .filter(q => q.eq(q.field("isSkGenerated"), false)) // Only delete those waiting for SK
            .collect();

        for (const t of candidates) {
            await ctx.db.delete(t._id);
        }
        teachersDeleted = candidates.length;
    }

    // 3. Always clean Draft/Unverified junk if just running default (no args)?
    if (!args.deleteTeachers && !args.deleteSk) {
         // Original default behavior: Clear drafts
         const draftTeachers = await ctx.db
            .query("teachers")
            .filter(q => q.eq(q.field("status"), "draft"))
            .collect();
         for (const t of draftTeachers) await ctx.db.delete(t._id);
         teachersDeleted = draftTeachers.length;
    }

    console.log(`Cleanup finished. SK: ${skDeleted}, Teachers: ${teachersDeleted}`);
    return { skDeleted, teachersDeleted };
  },
});
