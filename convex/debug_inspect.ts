
import { convexToJson } from "convex/values";
import { query } from "./_generated/server";
import { v } from "convex/values";

export const inspect = query({
  args: {},
  handler: async (ctx) => {
    // 1. Env Info (if possible, or just deduce from data)
    const teacherCount = (await ctx.db.query("teachers").take(1)).length;
    const tenureCount = (await ctx.db.query("headmasterTenures").take(1)).length;

    // 2. Raw Samples
    const teachers = await ctx.db.query("teachers").take(5);
    const tenures = await ctx.db.query("headmasterTenures").take(5);

    return {
      ENV_CHECK: {
        hasTeachers: teacherCount > 0,
        hasTenures: tenureCount > 0,
      },
      TEACHER_SAMPLES: teachers.map(t => ({ id: t._id, nama: t.nama, tmt: t.tmt })),
      TENURE_SAMPLES: tenures.map(t => ({ id: t._id, teacherId: t.teacherId, skUrl: t.skUrl })),
      SEARCH_ID_CHECK: "jx79t573s6nbav3etsyw4peyc180z1q7",
      ID_FOUND: tenures.some(t => t._id === "jx79t573s6nbav3etsyw4peyc180z1q7")
    };
  },
});
