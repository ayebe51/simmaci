
import { convexToJson } from "convex/values";
import { query } from "./_generated/server";
import { v } from "convex/values";

export const inspect = query({
  args: {},
  handler: async (ctx) => {
    // 1. Search for teacher "Maslahul" - FULL SCAN to be sure
    const teachers = await ctx.db.query("teachers").collect();
      
    const matches = teachers.filter(t => t.nama && t.nama.toLowerCase().includes("maslahul"));

    // 2. Get recent Headmaster Tenures
    const tenures = await ctx.db.query("headmasterTenures").collect();
    const targetTenure = tenures.find(t => t.teacherName?.toLowerCase().includes("maslahul") || t._id === "jx79t573s6nbav3etsyw4peyc180z1q7");

    return {
      TEACHER_MATCHES: matches.map(m => ({
          id: m._id,
          nama: m.nama,
          tmt: m.tmt,
          tmt_type: typeof m.tmt,
          unit: m.unitKerja,
          isActive: m.isActive
      })),
      TENURE_MATCH: targetTenure ? {
          id: targetTenure._id,
          teacherId: targetTenure.teacherId,
          teacherName: targetTenure.teacherName,
          status: targetTenure.status,
          skUrl: targetTenure.skUrl
      } : "Tenure Not Found"
    };
  },
});
