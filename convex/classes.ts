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

// Get wali kelas assignment for a school
export const getWaliKelas = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

// Set wali kelas for a class name (upsert)
export const setWaliKelas = mutation({
  args: {
    schoolId: v.id("schools"),
    nama: v.string(),
    tingkat: v.string(),
    waliKelasId: v.optional(v.id("teachers")),
    tahunAjaran: v.string(),
  },
  handler: async (ctx, args) => {
    // Find existing class by name and school
    const existing = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const match = existing.find((c) => c.nama === args.nama);
    const now = Date.now();

    if (match) {
      await ctx.db.patch(match._id, {
        waliKelasId: args.waliKelasId,
        tingkat: args.tingkat,
        tahunAjaran: args.tahunAjaran,
        updatedAt: now,
      });
      return match._id;
    } else {
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
    }
  },
});

// Auto-sync classes from students table
export const autoSyncFromStudents = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return;

    // Get all students for this school
    const students = await ctx.db
      .query("students")
      .filter((q) => q.eq(q.field("namaSekolah"), school.nama))
      .collect();

    // Extract unique class names
    const classNames = new Set<string>();
    for (const s of students) {
      if (s.kelas) classNames.add(String(s.kelas));
    }

    // Get existing classes
    const existingClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    let addedCount = 0;
    const now = Date.now();

    // Insert any missing classes
    for (const className of classNames) {
      if (!existingClasses.some((c) => c.nama === className)) {
        await ctx.db.insert("classes", {
          nama: className,
          tingkat: className.replace(/[^0-9IVX]/gi, "") || className,
          tahunAjaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          schoolId: args.schoolId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        addedCount++;
      }
    }

    return { success: true, added: addedCount };
  },
});
