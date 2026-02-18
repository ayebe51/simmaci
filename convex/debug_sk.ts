
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const populate = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.insert("skDocuments", {
        nama: "Debug SK",
        nomorSk: "SK-DEBUG-001",
        jenisSk: "gty",
        status: "draft",
        tanggalPenetapan: "2024-01-01",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
  }
});

export const checkIndices = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("skDocuments").collect();
    const byStatus = await ctx.db.query("skDocuments").withIndex("by_status", q => q.eq("status", "draft")).collect();
    return { all: all.length, byStatus: byStatus.length, sample: all[0] };
  }
});

export const testListDefault = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("skDocuments").order("desc").paginate({numItems: 5, cursor: null}); 
    }
});

export const testListBySchoolStatus = query({
    args: { schoolId: v.optional(v.string()) }, // Accept string to test resolving
    handler: async (ctx, args) => {
        // Find a school first if not provided
        let schoolId = args.schoolId;
        if (!schoolId) {
             const s = await ctx.db.query("schools").first();
             if (s) schoolId = s._id;
        }
        
        if (!schoolId) return "No school found";

        return await ctx.db.query("skDocuments")
        // .withIndex("by_school_status", q => q.eq("schoolId", schoolId as any).eq("status", "draft"))
        .filter(q => q.eq(q.field("schoolId"), schoolId).eq(q.field("status"), "draft"))
            .order("desc")
            .paginate({numItems: 5, cursor: null});
    }
});

// Simulate exactly what frontend sends
export const testExactArgs = query({
    args: {
        // We replicate list args here manually to test validation
        jenisSk: v.optional(v.string()),
        search: v.optional(v.string()),
        status: v.optional(v.string()),
        userRole: v.optional(v.string()), 
        userUnit: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        console.log("Debug Exact Args:", args);
        return args; 
    }
});
