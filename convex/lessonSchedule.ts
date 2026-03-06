import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List schedule by school
export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("lessonSchedule")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    // Sort by jamKe ascending
    return items.sort((a, b) => a.jamKe - b.jamKe);
  },
});

// Save (upsert) a single lesson slot
export const save = mutation({
  args: {
    schoolId: v.id("schools"),
    jamKe: v.number(),
    jamMulai: v.string(),
    jamSelesai: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if slot already exists
    const existing = await ctx.db
      .query("lessonSchedule")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const slot = existing.find((s) => s.jamKe === args.jamKe);
    if (slot) {
      await ctx.db.patch(slot._id, {
        jamMulai: args.jamMulai,
        jamSelesai: args.jamSelesai,
      });
      return slot._id;
    } else {
      return await ctx.db.insert("lessonSchedule", {
        schoolId: args.schoolId,
        jamKe: args.jamKe,
        jamMulai: args.jamMulai,
        jamSelesai: args.jamSelesai,
        createdAt: Date.now(),
      });
    }
  },
});

// Bulk save all lesson slots for a school
export const saveBulk = mutation({
  args: {
    schoolId: v.id("schools"),
    slots: v.array(
      v.object({
        jamKe: v.number(),
        jamMulai: v.string(),
        jamSelesai: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete existing slots for this school
    const existing = await ctx.db
      .query("lessonSchedule")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    for (const slot of existing) {
      await ctx.db.delete(slot._id);
    }
    // Insert new slots
    const now = Date.now();
    for (const slot of args.slots) {
      await ctx.db.insert("lessonSchedule", {
        schoolId: args.schoolId,
        jamKe: slot.jamKe,
        jamMulai: slot.jamMulai,
        jamSelesai: slot.jamSelesai,
        createdAt: now,
      });
    }
  },
});

// Remove a single slot
export const remove = mutation({
  args: { id: v.id("lessonSchedule") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
