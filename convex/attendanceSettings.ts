import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get attendance settings for a school
export const get = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

// Save/update attendance settings
export const save = mutation({
  args: {
    schoolId: v.id("schools"),
    absensiGuruAktif: v.boolean(),
    absensiSiswaAktif: v.boolean(),
    scannerPin: v.optional(v.string()),
    qrScanAktif: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        absensiGuruAktif: args.absensiGuruAktif,
        absensiSiswaAktif: args.absensiSiswaAktif,
        scannerPin: args.scannerPin,
        qrScanAktif: args.qrScanAktif,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("attendanceSettings", {
        schoolId: args.schoolId,
        absensiGuruAktif: args.absensiGuruAktif,
        absensiSiswaAktif: args.absensiSiswaAktif,
        scannerPin: args.scannerPin,
        qrScanAktif: args.qrScanAktif,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Verify scanner PIN (public query for teachers)
export const verifyPin = query({
  args: {
    schoolId: v.id("schools"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (!settings || !settings.scannerPin) {
      return { valid: false, message: "Fitur absensi belum diaktifkan untuk sekolah ini" };
    }
    if (settings.scannerPin !== args.pin) {
      return { valid: false, message: "PIN salah" };
    }
    return {
      valid: true,
      absensiGuruAktif: settings.absensiGuruAktif,
      absensiSiswaAktif: settings.absensiSiswaAktif,
      qrScanAktif: settings.qrScanAktif,
    };
  },
});

// Login by PIN only - auto detect school
export const loginByPin = query({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const allSettings = await ctx.db.query("attendanceSettings").collect();
    const match = allSettings.find((s) => s.scannerPin === args.pin);

    if (!match) {
      return { valid: false, message: "PIN tidak ditemukan" };
    }

    const school = await ctx.db.get(match.schoolId);
    if (!school) {
      return { valid: false, message: "Sekolah tidak ditemukan" };
    }

    return {
      valid: true,
      schoolId: match.schoolId,
      schoolName: school.nama,
      absensiGuruAktif: match.absensiGuruAktif,
      absensiSiswaAktif: match.absensiSiswaAktif,
      qrScanAktif: match.qrScanAktif,
    };
  },
});
