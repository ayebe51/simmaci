import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List subjects by school
export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

// List active subjects by school
export const listActive = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subjects")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true)
      )
      .collect();
  },
});

// Create subject
export const create = mutation({
  args: {
    nama: v.string(),
    kode: v.optional(v.string()),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("subjects", {
      nama: args.nama,
      kode: args.kode,
      schoolId: args.schoolId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update subject
export const update = mutation({
  args: {
    id: v.id("subjects"),
    nama: v.string(),
    kode: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      nama: args.nama,
      kode: args.kode,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
  },
});

// Remove subject
export const remove = mutation({
  args: { id: v.id("subjects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
