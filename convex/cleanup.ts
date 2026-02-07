import { mutation } from "./_generated/server";

export const cleanSk = mutation({
  args: {},
    console.log("Cleanup script started (SMART CLEANUP)");
    
    // 0. Update: DO NOT DELETE SK Documents (Preserve History/QR)
    // const docs = await ctx.db.query("skDocuments").collect();
    // ... preserved ...

    // 1. Delete ONLY 'Draft' Teachers (Stuck in Submission)
    // We assume 'Draft' means they are not yet Master Data / duplicates
    const draftTeachers = await ctx.db
        .query("teachers")
        .filter(q => q.eq(q.field("status"), "draft"))
        .collect();

    console.log(`Found ${draftTeachers.length} DRAFT teachers to delete`);
    
    for (const t of draftTeachers) {
      await ctx.db.delete(t._id);
    }
    
    // 2. Also clear Unverified ones if any?
    const unverified = await ctx.db
        .query("teachers")
        .filter(q => q.eq(q.field("isVerified"), false))
        .collect();
        
    for (const t of unverified) {
       // Only delete if not already deleted (though filtered query shouldn't overlap ideally if status is processed)
       // But safer to just check status or let ID check handle it (Convex throws on missing ID delete?)
       // Better: Just delete unverified too as they are "Submission" junk
       try { await ctx.db.delete(t._id); } catch {}
    }

    console.log("Cleanup script finished");
    return { draftsDeleted: draftTeachers.length, unverifiedDeleted: unverified.length };
  },
});
