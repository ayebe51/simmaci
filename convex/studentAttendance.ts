import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

    // After inserting records, trigger WhatsApp notifications if applicable
    const settings = await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (settings && settings.gowaUrl) {
      // Get class info for the message
      const classInfo = await ctx.db.get(args.classId);
      const className = classInfo?.nama || "Kelas Tidak Diketahui";
      const tanggalFormat = new Date(args.tanggal).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      for (const record of args.records) {
        if (record.status === "Alpha" || record.status === "Sakit" || record.status === "Izin") {
          // Fetch student to get phone number and name
          const student = await ctx.db
            .query("students")
            .withIndex("by_nisn", (q) => q.eq("nisn", record.studentId))
            .first();

          if (student && student.nomorTelepon) {
            const schoolName = student.namaSekolah;
            let message = "";
            if (record.status === "Alpha") {
              message = `Assalamu'alaikum Bapak/Ibu Wali dari *${student.nama}* (${className}).\n\nKami dari pihak *${schoolName}* menginformasikan bahwa putra/putri Bapak/Ibu tidak hadir di kelas hari ini (${tanggalFormat}) *tanpa keterangan (Alpha)*.\n\nMohon konfirmasi ke pihak sekolah. Terima kasih. 🙏`;
            } else if (record.status === "Sakit") {
              message = `Assalamu'alaikum Bapak/Ibu Wali dari *${student.nama}* (${className}).\n\nKami dari pihak *${schoolName}* menginformasikan bahwa ananda tercatat *Sakit* hari ini (${tanggalFormat}). Semoga lekas sembuh! 🙏`;
            } else if (record.status === "Izin") {
              message = `Assalamu'alaikum Bapak/Ibu Wali dari *${student.nama}* (${className}).\n\nKami dari pihak *${schoolName}* menginformasikan bahwa ananda tercatat *Izin* hari ini (${tanggalFormat}). Terima kasih atas konfirmasinya. 🙏`;
            }

            // Schedule the WhatsApp action asynchronously so it doesn't block the mutation
            await ctx.scheduler.runAfter(0, api.sendWhatsApp.sendMessage, {
              gowaUrl: settings.gowaUrl,
              deviceId: settings.gowaDeviceId || undefined,
              phone: student.nomorTelepon,
              message: message,
            });
          }
        }
      }
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
