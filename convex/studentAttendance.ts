import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Record a single student's attendance (from QR scan)
export const recordScan = mutation({
  args: {
    studentId: v.string(), // NISN
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    tanggal: v.string(),
    jamKe: v.optional(v.number()),
    recordedByTeacherId: v.optional(v.id("teachers")),
    scannedBy: v.optional(v.string()),
    kelasNama: v.optional(v.string()), // for class validation
  },
  handler: async (ctx, args) => {
    // Validate student belongs to the selected class (if kelasNama provided)
    if (args.kelasNama) {
      const student = await ctx.db
        .query("students")
        .withIndex("by_nisn", (q) => q.eq("nisn", args.studentId))
        .first();

      if (!student) {
        return { success: false, message: "Siswa tidak ditemukan" };
      }

      if (String(student.kelas) !== args.kelasNama) {
        return {
          success: false,
          message: `Siswa ${student.nama} terdaftar di kelas ${student.kelas}, bukan kelas ${args.kelasNama}`,
        };
      }
    }

    // Anti-duplikasi: check if student already has record for this subject today
    const existing = await ctx.db
      .query("studentAttendance")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
          .eq("tanggal", args.tanggal)
      )
      .collect();

    const duplicate = existing.find((r) => r.studentId === args.studentId);
    if (duplicate) {
      return { success: false, message: "Sudah tercatat hadir untuk mapel ini hari ini" };
    }

    const now = Date.now();
    const id = await ctx.db.insert("studentAttendance", {
      studentId: args.studentId,
      schoolId: args.schoolId,
      classId: args.classId,
      subjectId: args.subjectId,
      tanggal: args.tanggal,
      jamKe: args.jamKe,
      status: "Hadir",
      recordedByTeacherId: args.recordedByTeacherId,
      scannedBy: args.scannedBy,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, message: "Hadir", id };
  },
});

// Record bulk attendance (manual checklist)
export const recordBulk = mutation({
  args: {
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    tanggal: v.string(),
    jamKe: v.optional(v.number()),
    recordedByTeacherId: v.optional(v.id("teachers")),
    records: v.array(
      v.object({
        studentId: v.string(),
        status: v.string(),
        keterangan: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Delete existing records for this session to allow re-submit
    const existing = await ctx.db
      .query("studentAttendance")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
          .eq("tanggal", args.tanggal)
      )
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    // Insert new records
    for (const record of args.records) {
      await ctx.db.insert("studentAttendance", {
        studentId: record.studentId,
        schoolId: args.schoolId,
        classId: args.classId,
        subjectId: args.subjectId,
        tanggal: args.tanggal,
        jamKe: args.jamKe,
        status: record.status,
        keterangan: record.keterangan,
        recordedByTeacherId: args.recordedByTeacherId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true, count: args.records.length };
  },
});

// List attendance by class, subject, and date
export const listByClassSubjectDate = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studentAttendance")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
          .eq("tanggal", args.tanggal)
      )
      .collect();
  },
});

// List attendance by class and date (all subjects)
export const listByClassDate = query({
  args: {
    classId: v.id("classes"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studentAttendance")
      .withIndex("by_class_date", (q) =>
        q.eq("classId", args.classId).eq("tanggal", args.tanggal)
      )
      .collect();
  },
});

// Monthly recap by class and subject
export const rekapBulanan = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    bulan: v.string(), // "2026-03"
  },
  handler: async (ctx, args) => {
    const allRecords = await ctx.db
      .query("studentAttendance")
      .withIndex("by_class_subject_date", (q) =>
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .collect();

    return allRecords.filter((r) => r.tanggal.startsWith(args.bulan));
  },
});

// Get attendance for a specific student in a month
export const rekapSiswa = query({
  args: {
    studentId: v.string(),
    bulan: v.string(),
  },
  handler: async (ctx, args) => {
    const allRecords = await ctx.db
      .query("studentAttendance")
      .withIndex("by_student_date", (q) => q.eq("studentId", args.studentId))
      .collect();

    return allRecords.filter((r) => r.tanggal.startsWith(args.bulan));
  },
});

// List all attendance by school and date
export const listBySchoolDate = query({
  args: {
    schoolId: v.id("schools"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studentAttendance")
      .withIndex("by_school_date", (q) =>
        q.eq("schoolId", args.schoolId).eq("tanggal", args.tanggal)
      )
      .collect();
  },
});
