import { query } from "./_generated/server";
import { v } from "convex/values";

export const checkCimanggu = query({
  args: {},
  handler: async (ctx) => {
    // 1. Search for schools with "Cimanggu"
    const schools = await ctx.db.query("schools").collect();
    const cimangguSchools = schools.filter(s => s.nama.toLowerCase().includes("hm") || s.nama.toLowerCase().includes("cimanggu"));

    // 2. Search for schools with "Ma'arif" and "Cimanggu"
     const specificSchools = schools.filter(s => 
        s.nama.toLowerCase().includes("ma'arif") && 
        s.nama.toLowerCase().includes("cimanggu")
    );

    // 3. Check for any SKs with unitKerja like Cimanggu
    const allSks = await ctx.db.query("skDocuments").collect();
    const cimangguSks = allSks.filter(sk => 
        sk.unitKerja && sk.unitKerja.toLowerCase().includes("cimanggu")
    ).map(sk => ({
        _id: sk._id,
        nomorSk: sk.nomorSk,
        unitKerja: sk.unitKerja,
        schoolId: sk.schoolId,
        status: sk.status
    }));

    return {
        matchedSchools: specificSchools.map(s => ({ _id: s._id, nama: s.nama, nsm: s.nsm })),
        otherCimangguCandidates: cimangguSchools.map(s => ({ _id: s._id, nama: s.nama })),
        sks: cimangguSks
    };
  },
});
