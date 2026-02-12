
import { convexToJson } from "convex/values";
import { query } from "./_generated/server";
import { v } from "convex/values";

export const inspect = query({
  args: {},
  handler: async (ctx) => {
    // 1. Search for teacher "Maslahul"
    const teachers = await ctx.db
      .query("teachers")
      .filter((q) => q.gte(q.field("nama"), "Maslahul")) // Simple prefix check
      .take(10);
      
    const maslahul = teachers.find(t => t.nama.toLowerCase().includes("maslahul"));

    // 2. Get recent Headmaster Tenures
    const tenures = await ctx.db
      .query("headmasterTenures")
      .order("desc")
      .take(5);

    return {
      teacher_maslahul: maslahul ? {
          id: maslahul._id,
          nama: maslahul.nama,
          tmt: maslahul.tmt,
          tmt_type: typeof maslahul.tmt
      } : "Not Found",
      recent_tenures: tenures.map(t => ({
          id: t._id,
          teacherName: t.teacherName,
          status: t.status,
          skUrl: t.skUrl,
          createdAt: t._creationTime
      }))
    };
  },
});
