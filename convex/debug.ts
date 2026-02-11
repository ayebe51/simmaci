import { query, mutation } from "./_generated/server";

export const listUniqueStatuses = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    const statusCounts: Record<string, number> = {};

    teachers.forEach((t) => {
        const s = (t.status || "(EMPTY)").trim().toUpperCase();
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    return statusCounts;
  },
});

export const testInsert = mutation({
  args: {},
  handler: async (ctx) => {
    try {
        console.log("TESTING INSERT...");
        const now = Date.now();
        const dummy = {
            nuptk: "9999999999999999",
            nama: "TEST TEACHER " + now,
            unitKerja: "TEST UNIT",
            status: "GTT",
            mapel: "TEST MAPEL",
            phoneNumber: "08123456789",
            pdpkpnu: "Belum",
            kecamatan: "Cilacap Tengah",
            tempatLahir: "Cilacap",
            tanggalLahir: "2000-01-01",
            tmt: "2020-01-01",
            isCertified: false,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };
        
        const id = await ctx.db.insert("teachers", dummy);
        console.log("INSERT SUCCESS:", id);
        return id;
    } catch (e: any) {
        console.error("INSERT FAILED:", e);
        throw new Error(e.message);
    } 
  },
});
