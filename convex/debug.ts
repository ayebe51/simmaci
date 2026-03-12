
import { query } from "./_generated/server";

export const diagnoseMismatches = query({
  handler: async (ctx) => {
    const operators = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "operator"))
      .collect();
    
    const schools = await ctx.db.query("schools").collect();
    
    const unitNames = operators.map(u => u.unit);
    const schoolNames = schools.map(s => s.nama);
    
    const matches = schools.map(s => {
        const match = operators.find(u => u.unit === s.nama || u.email.includes(s.nsm));
        return {
            schoolNama: s.nama,
            schoolNsm: s.nsm,
            hasMatch: !!match,
            matchEmail: match?.email,
            matchUnit: match?.unit
        };
    });

    return {
        totalSchools: schools.length,
        totalOperators: operators.length,
        sampleMismatches: matches.filter(m => !m.hasMatch).slice(0, 10),
        sampleMatches: matches.filter(m => m.hasMatch).slice(0, 10),
        operatorUnitsSample: unitNames.slice(0, 20)
    };
  }
});
