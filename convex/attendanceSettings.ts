import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper: generate a random 6-digit PIN
function createRandomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Helper: check if PIN is already used by another school
async function isPinUnique(ctx: any, pin: string, excludeSchoolId?: any): Promise<boolean> {
  const allSettings = await ctx.db.query("attendanceSettings").collect();
  return !allSettings.some(
    (s: any) => s.scannerPin === pin && (!excludeSchoolId || s.schoolId !== excludeSchoolId)
  );
}

// Helper: generate a guaranteed-unique PIN
async function generateUniquePin(ctx: any, excludeSchoolId?: any): Promise<string> {
  let pin = createRandomPin();
  let attempts = 0;
  while (!(await isPinUnique(ctx, pin, excludeSchoolId)) && attempts < 100) {
    pin = createRandomPin();
    attempts++;
  }
  return pin;
}

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

// Save/update attendance settings — auto-generates PIN if not set
export const save = mutation({
  args: {
    schoolId: v.id("schools"),
    absensiGuruAktif: v.boolean(),
    absensiSiswaAktif: v.boolean(),
    scannerPin: v.optional(v.string()),
    qrScanAktif: v.boolean(),
    gowaUrl: v.optional(v.string()),
    gowaDeviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    // Auto-generate PIN if not provided or empty
    let pin = args.scannerPin;
    if (!pin || pin.trim() === "") {
      pin = await generateUniquePin(ctx, args.schoolId);
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        absensiGuruAktif: args.absensiGuruAktif,
        absensiSiswaAktif: args.absensiSiswaAktif,
        scannerPin: pin,
        qrScanAktif: args.qrScanAktif,
        gowaUrl: args.gowaUrl || undefined,
        gowaDeviceId: args.gowaDeviceId || undefined,
        updatedAt: now,
      });
      return { id: existing._id, pin };
    } else {
      const id = await ctx.db.insert("attendanceSettings", {
        schoolId: args.schoolId,
        absensiGuruAktif: args.absensiGuruAktif,
        absensiSiswaAktif: args.absensiSiswaAktif,
        scannerPin: pin,
        qrScanAktif: args.qrScanAktif,
        gowaUrl: args.gowaUrl || undefined,
        gowaDeviceId: args.gowaDeviceId || undefined,
        createdAt: now,
        updatedAt: now,
      });
      return { id, pin };
    }
  },
});

// Generate a new unique PIN for a school (regenerate)
export const regeneratePin = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    const newPin = await generateUniquePin(ctx, args.schoolId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        scannerPin: newPin,
        updatedAt: Date.now(),
      });
    }

    return { pin: newPin };
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
      gowaUrl: settings.gowaUrl || undefined,
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
      gowaUrl: match.gowaUrl || undefined,
    };
  },
});
