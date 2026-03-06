import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List classes by school
export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

// List active classes by school
export const listActive = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("classes")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true)
      )
      .collect();
  },
});

// Create class
export const create = mutation({
  args: {
    nama: v.string(),
    tingkat: v.string(),
    tahunAjaran: v.string(),
    waliKelasId: v.optional(v.id("teachers")),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("classes", {
      nama: args.nama,
      tingkat: args.tingkat,
      tahunAjaran: args.tahunAjaran,
      waliKelasId: args.waliKelasId,
      schoolId: args.schoolId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update class
export const update = mutation({
  args: {
    id: v.id("classes"),
    nama: v.string(),
    tingkat: v.string(),
    tahunAjaran: v.string(),
    waliKelasId: v.optional(v.id("teachers")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      nama: args.nama,
      tingkat: args.tingkat,
      tahunAjaran: args.tahunAjaran,
      waliKelasId: args.waliKelasId,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
  },
});

// Remove class
export const remove = mutation({
  args: { id: v.id("classes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
