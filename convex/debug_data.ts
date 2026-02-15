import { query } from "./_generated/server";

export const dumpCimanggu = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    
    // Filter loose "Cimanggu"
    const targets = teachers.filter(t => 
        (t.unitKerja || "").toLowerCase().includes("cimanggu") ||
        (t.unitKerja || "").toLowerCase().includes("ma'arif nu")
    );

    return targets.map(t => ({
        id: t._id,
        nama: t.nama,
        unit: t.unitKerja,
        nuptk: t.nuptk,
        schoolId: t.schoolId
    }));
  }
});
