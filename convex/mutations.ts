import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateSession, requireAuth } from "./auth_helpers";

// Move teacher to new school
export const moveTeacher = mutation({
  args: {
    token: v.string(),
    teacherId: v.id("teachers"),
    toUnit: v.string(), // School Name
    reason: v.string(),
    skNumber: v.string(),
    effectiveDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.token);

    // RBAC: Only Admin/Super Admin
    if (!["admin", "super_admin"].includes(user.role)) {
       throw new Error("Unauthorized: Only Admins can perform mutations.");
    }

    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher) throw new Error("Teacher not found");

    const fromUnit = teacher.unitKerja || "Tidak Ada";

    // 1. Log Mutation
    await ctx.db.insert("teacher_mutations", {
      teacherId: args.teacherId,
      fromUnit: fromUnit,
      toUnit: args.toUnit,
      reason: args.reason,
      skNumber: args.skNumber,
      effectiveDate: args.effectiveDate,
      performedBy: user._id,
      createdAt: Date.now(),
    });

    // 2. Update Teacher
    await ctx.db.patch(args.teacherId, {
      unitKerja: args.toUnit,
      updatedAt: Date.now(),
      // Reset other school-specific flags if needed?
      // For now keep data.
    });

    return { success: true };
  },
});

// List mutations
export const list = query({
  args: {
    token: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const mutations = await ctx.db.query("teacher_mutations").order("desc").take(50);
    
    // Enrich with teacher names?
    const results = await Promise.all(mutations.map(async (m) => {
        const teacher = await ctx.db.get(m.teacherId);
        const admin = await ctx.db.get(m.performedBy);
        return {
            ...m,
            teacherName: teacher?.nama || "Unknown",
            adminName: admin?.name || "Unknown"
        }
    }));

    return results;
  }
});
