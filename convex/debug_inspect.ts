import { query } from "./_generated/server";

export const recent = query({
  args: {},
  handler: async (ctx) => {
    // Fetch 10 most recently updated teachers
    const teachers = await ctx.db
      .query("teachers")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(10);

    return teachers.map(t => ({
      name: t.nama,
      unit: t.unitKerja,
      schoolId: t.schoolId,
      isSkGenerated: t.isSkGenerated,
      isActive: t.isActive,
      updatedAt: new Date(t.updatedAt).toISOString()
    }));
  },
});
