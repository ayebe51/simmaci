import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Clock in (scan masuk) — creates a new attendance record for today
export const clockIn = mutation({
  args: {
    teacherId: v.id("teachers"),
    schoolId: v.id("schools"),
    scannedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });

    // Check if already clocked in today
    const existing = await ctx.db
      .query("teacherAttendance")
      .withIndex("by_teacher_date", (q) =>
        q.eq("teacherId", args.teacherId).eq("tanggal", today)
      )
      .first();

    if (existing) {
      return { success: false, message: "Sudah absen masuk hari ini", data: existing };
    }

    const id = await ctx.db.insert("teacherAttendance", {
      teacherId: args.teacherId,
      schoolId: args.schoolId,
      tanggal: today,
      jamMasuk: timeStr,
      status: "Hadir",
      scannedBy: args.scannedBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, message: `Jam masuk tercatat: ${timeStr}`, id };
  },
});

// Clock out (scan pulang) — updates the existing record
export const clockOut = mutation({
  args: {
    teacherId: v.id("teachers"),
    scannedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });

    const existing = await ctx.db
      .query("teacherAttendance")
      .withIndex("by_teacher_date", (q) =>
        q.eq("teacherId", args.teacherId).eq("tanggal", today)
      )
      .first();

    if (!existing) {
      return { success: false, message: "Belum absen masuk hari ini" };
    }

    if (existing.jamPulang) {
      return { success: false, message: "Sudah absen pulang hari ini", data: existing };
    }

    await ctx.db.patch(existing._id, {
      jamPulang: timeStr,
      updatedAt: Date.now(),
    });

    return { success: true, message: `Jam pulang tercatat: ${timeStr}` };
  },
});

// Smart scan — determines if it's clock-in or clock-out
export const smartScan = mutation({
  args: {
    teacherId: v.id("teachers"),
    schoolId: v.id("schools"),
    scannedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });

    const existing = await ctx.db
      .query("teacherAttendance")
      .withIndex("by_teacher_date", (q) =>
        q.eq("teacherId", args.teacherId).eq("tanggal", today)
      )
      .first();

    if (!existing) {
      // Clock in
      const id = await ctx.db.insert("teacherAttendance", {
        teacherId: args.teacherId,
        schoolId: args.schoolId,
        tanggal: today,
        jamMasuk: timeStr,
        status: "Hadir",
        scannedBy: args.scannedBy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { success: true, type: "masuk", message: `Jam Masuk: ${timeStr}`, id };
    }

    if (!existing.jamPulang) {
      // Clock out
      await ctx.db.patch(existing._id, {
        jamPulang: timeStr,
        updatedAt: Date.now(),
      });
      return { success: true, type: "pulang", message: `Jam Pulang: ${timeStr}` };
    }

    return { success: false, type: "done", message: "Sudah absen masuk dan pulang hari ini" };
  },
});

// Record manual attendance (by operator)
export const recordManual = mutation({
  args: {
    teacherId: v.id("teachers"),
    schoolId: v.id("schools"),
    tanggal: v.string(),
    status: v.string(),
    jamMasuk: v.optional(v.string()),
    jamPulang: v.optional(v.string()),
    keterangan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teacherAttendance")
      .withIndex("by_teacher_date", (q) =>
        q.eq("teacherId", args.teacherId).eq("tanggal", args.tanggal)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        jamMasuk: args.jamMasuk,
        jamPulang: args.jamPulang,
        keterangan: args.keterangan,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("teacherAttendance", {
      teacherId: args.teacherId,
      schoolId: args.schoolId,
      tanggal: args.tanggal,
      status: args.status,
      jamMasuk: args.jamMasuk,
      jamPulang: args.jamPulang,
      keterangan: args.keterangan,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// List attendance by school and date
export const listByDate = query({
  args: {
    schoolId: v.id("schools"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teacherAttendance")
      .withIndex("by_school_date", (q) =>
        q.eq("schoolId", args.schoolId).eq("tanggal", args.tanggal)
      )
      .collect();
  },
});

// Get today's attendance for a teacher
export const getByTeacherDate = query({
  args: {
    teacherId: v.id("teachers"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teacherAttendance")
      .withIndex("by_teacher_date", (q) =>
        q.eq("teacherId", args.teacherId).eq("tanggal", args.tanggal)
      )
      .first();
  },
});

// Monthly recap for a school
export const rekapBulanan = query({
  args: {
    schoolId: v.id("schools"),
    bulan: v.string(), // "2026-03"
  },
  handler: async (ctx, args) => {
    // Get all attendance for this month
    const allRecords = await ctx.db
      .query("teacherAttendance")
      .withIndex("by_school_date", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    // Filter by month prefix
    return allRecords.filter((r) => r.tanggal.startsWith(args.bulan));
  },
});
