import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").order("desc").take(5);
    return teachers.map(t => ({
        id: t._id,
        nama: t.nama,
        schoolId: t.schoolId,
        unit: t.unitKerja,
        isSk: t.isSkGenerated,
        updated: t.updatedAt
    }));
  },
});
