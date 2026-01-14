import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all headmaster tenures with optional filters
export const list = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    teacherId: v.optional(v.id("teachers")),
    status: v.optional(v.string()),
    schoolName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tenures = await ctx.db.query("headmasterTenures").collect();
    
    // Apply filters
    if (args.schoolId) {
      tenures = tenures.filter(t => t.schoolId === args.schoolId);
    }
    
    if (args.teacherId) {
      tenures = tenures.filter(t => t.teacherId === args.teacherId);
    }
    
    if (args.status && args.status !== "all") {
      tenures = tenures.filter(t => t.status === args.status);
    }
    
    if (args.schoolName && args.schoolName.trim()) {
      tenures = tenures.filter(t => 
        t.schoolName.toLowerCase().includes(args.schoolName!.toLowerCase())
      );
    }
    
    return tenures;
  },
});

// Get single tenure by ID
export const get = query({
  args: { id: v.id("headmasterTenures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create new headmaster tenure
export const create = mutation({
  args: {
    teacherId: v.id("teachers"),
    teacherName: v.string(),
    schoolId: v.id("schools"),
    schoolName: v.string(),
    periode: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.optional(v.string()),
    skUrl: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    return await ctx.db.insert("headmasterTenures", {
      ...args,
      status: args.status || "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update headmaster tenure
export const update = mutation({
  args: {
    id: v.id("headmasterTenures"),
    teacherId: v.optional(v.id("teachers")),
    teacherName: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
    schoolName: v.optional(v.string()),
    periode: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.string()),
    skUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return id;
  },
});

// Approve headmaster tenure
export const approve = mutation({
  args: {
    id: v.id("headmasterTenures"),
    approvedBy: v.id("users"),
    skUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    await ctx.db.patch(args.id, {
      status: "approved",
      approvedBy: args.approvedBy,
      approvedAt: now,
      skUrl: args.skUrl,
      updatedAt: now,
    });
    
    return args.id;
  },
});

// Reject headmaster tenure
export const reject = mutation({
  args: {
    id: v.id("headmasterTenures"),
    rejectedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "rejected",  
      updatedAt: Date.now(),
    });
    
    return args.id;
  },
});

// Get active headmaster for a school
export const getActiveBySchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const tenures = await ctx.db
      .query("headmasterTenures")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    
    // Find the currently active tenure
    return tenures.find(t => t.status === "active");
  },
});

// Get count by status
export const countByStatus = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tenures = await ctx.db.query("headmasterTenures").collect();
    
    if (args.status) {
      tenures = tenures.filter(t => t.status === args.status);
    }
    
    return tenures.length;
  },
});
