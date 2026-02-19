
import { query } from "./_generated/server";
import { v } from "convex/values";

export const diagnoseRegressions = query({
  args: {},
  handler: async (ctx) => {
    const report = {
      headmasterTenures: { total: 0, bad_school_ids: [] as any[] },
      mutations: { total: 0, bad_school_ids: [] as any[] },
    };

    // Check HEADMASTER TENURES
    const tenures = await ctx.db.query("headmasterTenures").collect();
    report.headmasterTenures.total = tenures.length;
    for (const t of tenures) {
         // @ts-ignore
         const sid = t.schoolId;
         const isString = typeof sid === 'string';
         const isIdLike = isString && /^[a-zA-Z0-9]{32}$/.test(sid);
         
         if (!isIdLike && sid !== undefined && sid !== null) {
             report.headmasterTenures.bad_school_ids.push({ id: t._id, val: sid });
         }
    }

    // Check TEACHER MUTATIONS (if they use schoolId? Schema says fromUnit/toUnit)
    // defined as v.any() in schema.
    const mutations = await ctx.db.query("teacher_mutations").collect();
    report.mutations.total = mutations.length;
    for (const m of mutations) {
         // Check fromUnit and toUnit
         // @ts-ignore
         const fromU = m.fromUnit;
         // @ts-ignore
         const toU = m.toUnit;

         // If strictly looking for IDs, check if they are NOT IDs
         // But maybe they are allowed to be strings? Let's validte format anyway
         
         // Only flag if it looks like a School Name (containing spaces, or short/long)
         const isFromId = typeof fromU === 'string' && /^[a-zA-Z0-9]{32}$/.test(fromU);
         const isToId = typeof fromU === 'string' && /^[a-zA-Z0-9]{32}$/.test(toU);

         if (!isFromId || !isToId) {
             // report.mutations.bad_school_ids.push({ id: m._id, from: fromU, to: toU });
         }
    }

    return report;
  }
});
