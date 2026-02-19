// @ts-nocheck
import { query, mutation } from "./_generated/server";
import { create } from "./teachers";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { validateSession, requireAuth } from "./auth_helpers";

// Move teacher to new school
export const moveTeacher = mutation({
  args: {
    token: v.string(),
    teacherId: v.id("teachers"),
    toUnit: v.string(), // School Name
    reason: v.string(),
    skNumber: v.string(),
    effectiveDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.token);

    // RBAC: Only Admin/Super Admin
    if (!["admin", "super_admin"].includes(user.role)) {
       throw new Error("Unauthorized: Only Admins can perform mutations.");
    }

    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher) throw new Error("Teacher not found");

    const fromUnit = teacher.unitKerja || "Tidak Ada";

    // 1. Log Mutation
    await ctx.db.insert("teacher_mutations", {
      teacherId: args.teacherId,
      fromUnit: fromUnit,
      toUnit: args.toUnit,
      reason: args.reason,
      skNumber: args.skNumber,
      effectiveDate: args.effectiveDate,
      performedBy: user._id,
      createdAt: Date.now(),
    });

    // 2. Update Teacher
    await ctx.db.patch(args.teacherId, {
      unitKerja: args.toUnit,
      updatedAt: Date.now(),
      // Reset other school-specific flags if needed?
      // For now keep data.
    });

    return { success: true };
  },
});

// List mutations
export const list = query({
  args: {
    token: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const mutations = await ctx.db.query("teacher_mutations").order("desc").take(50);
    
    // Enrich with teacher names?
    const results = await Promise.all(mutations.map(async (m) => {
        let teacher = null;
        let admin = null;

        // SAFE Teacher Get
        // @ts-ignore
        if (m.teacherId && typeof m.teacherId === 'string' && /^[a-zA-Z0-9]{32}$/.test(m.teacherId)) {
             // @ts-ignore
             teacher = await ctx.db.get(m.teacherId).catch(() => null);
        }

        // SAFE Admin Get
        // @ts-ignore
        if (m.performedBy && typeof m.performedBy === 'string' && /^[a-zA-Z0-9]{32}$/.test(m.performedBy)) {
             // @ts-ignore
             admin = await ctx.db.get(m.performedBy).catch(() => null);
        }

        return {
            ...m,
            teacherName: teacher?.nama || "Unknown",
            adminName: admin?.name || "Unknown"
        }
    }));


    return results;
  }
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

export const testCreate = mutation({
  args: {},
  handler: async (ctx) => {
    try {
        console.log("TESTING CREATE DELEGATE...");
        const now = Date.now();
        const dummy = {
            nuptk: "8888888888888888",
            nama: "TEST DELEGATE " + now,
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
            // nip, email, photoId omitted
        };
        
        // Directly call the handler of teachers:create
        // We cast to any because the handler property is internal/typed awkwardly
        const result = await (create as any).handler(ctx, dummy);
        console.log("CREATE DELEGATE SUCCESS:", result);
        return result;
    } catch (e: any) {
        console.error("CREATE DELEGATE FAILED:", e);
        throw new Error(e.message);
    } 
  },
});


