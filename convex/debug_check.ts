import { query } from "./_generated/server";

export const check = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db
      .query("teachers")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(10);

    return teachers.map(t => ({
      name: t.nama,
      unit: t.unitKerja,
      schoolId: t.schoolId, // Vital check
      isSkGenerated: t.isSkGenerated, // Vital check
      isActive: t.isActive,
      updatedAt: new Date(t.updatedAt).toLocaleTimeString(),
      _id: t._id
    }));
  },
});
