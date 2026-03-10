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
    // 1. Validate student belongs to the selected class (if kelasNama provided)
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

    // 2. Fetch or Create Log for this session
    const existingLog = await ctx.db
      .query("studentAttendanceLogs")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
          .eq("tanggal", args.tanggal)
      )
      .first();

    const now = Date.now();
    const currentTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const logs = existingLog ? { ...(existingLog.logs || {}) } : {};

    // 3. Update specific student entry in logs object
    const studentEntry = logs[args.studentId];
    if (studentEntry && studentEntry.status === "Hadir") {
      return { success: false, message: "Sudah tercatat hadir untuk mapel ini hari ini" };
    }

    logs[args.studentId] = {
      status: "Hadir",
      jam: currentTime,
      scannedBy: args.scannedBy,
      recordedByTeacherId: args.recordedByTeacherId,
      updatedAt: now,
    };

    if (existingLog) {
      await ctx.db.patch(existingLog._id, {
        logs,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("studentAttendanceLogs", {
        schoolId: args.schoolId,
        classId: args.classId,
        subjectId: args.subjectId,
        tanggal: args.tanggal,
        jamKe: args.jamKe,
        logs,
        updatedAt: now,
      });
    }

    // 4. Trigger WhatsApp notification for Arrival (Feature 1)
    // ONLY if recording a NEW scan (or status changed to Hadir)
    const isNewHadir = !existingLog || !existingLog.logs?.[args.studentId] || existingLog.logs[args.studentId].status !== "Hadir";

    if (isNewHadir) {
      const settings = await ctx.db
        .query("attendanceSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
        .first();

      if (settings && settings.gowaUrl) {
        const student = await ctx.db
          .query("students")
          .withIndex("by_nisn", (q) => q.eq("nisn", args.studentId))
          .first();

        if (student && student.nomorTelepon) {
          const classInfo = await ctx.db.get(args.classId);
          const className = classInfo?.nama || "Kelas";
          const schoolName = student.namaSekolah || "Madrasah";
          
          const message = `Alhamdulillah, ananda *${student.nama}* (${className}) telah sampai di *${schoolName}* pada pukul *${currentTime}*. 🙏`;

          await ctx.scheduler.runAfter(0, api.sendWhatsApp.sendMessage, {
            gowaUrl: settings.gowaUrl,
            deviceId: settings.gowaDeviceId || undefined,
            phone: student.nomorTelepon,
            message: message,
          });
        }
      }
    }

    return { success: true, message: "Hadir" };
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

    // 1. Get or Create Log
    const existingLog = await ctx.db
      .query("studentAttendanceLogs")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
          .eq("tanggal", args.tanggal)
      )
      .first();

    const logs = existingLog ? { ...(existingLog.logs || {}) } : {};
    const currentTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // 2. Perform Batch Update to the logs object
    for (const record of args.records) {
      // Preserve original scan time if updating an existing record to same status
      const existingEntry = logs[record.studentId];
      
      logs[record.studentId] = {
        status: record.status,
        keterangan: record.keterangan || "",
        jam: existingEntry?.jam || currentTime,
        recordedByTeacherId: args.recordedByTeacherId,
        updatedAt: now,
      };
    }

    if (existingLog) {
      await ctx.db.patch(existingLog._id, { logs, updatedAt: now });
    } else {
      await ctx.db.insert("studentAttendanceLogs", {
        schoolId: args.schoolId,
        classId: args.classId,
        subjectId: args.subjectId,
        tanggal: args.tanggal,
        jamKe: args.jamKe,
        logs,
        updatedAt: now,
      });
    }

    // 3. Trigger WhatsApp notifications
    const settings = await ctx.db
      .query("attendanceSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (settings && settings.gowaUrl) {
      const classInfo = await ctx.db.get(args.classId);
      const className = classInfo?.nama || "Kelas Tidak Diketahui";
      const tanggalFormat = new Date(args.tanggal).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      for (const record of args.records) {
        if (["Alpha", "Sakit", "Izin"].includes(record.status)) {
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

// Helper to flatten logs back to old format
function flattenLog(logRecord: any) {
  if (!logRecord || !logRecord.logs) return [];
  return Object.entries(logRecord.logs).map(([studentId, entry]: [string, any]) => ({
    studentId,
    schoolId: logRecord.schoolId,
    classId: logRecord.classId,
    subjectId: logRecord.subjectId,
    tanggal: logRecord.tanggal,
    jamKe: logRecord.jamKe,
    status: entry.status,
    keterangan: entry.keterangan,
    jam: entry.jam,
    scannedBy: entry.scannedBy,
    recordedByTeacherId: entry.recordedByTeacherId,
    createdAt: logRecord._creationTime,
    updatedAt: entry.updatedAt,
  }));
}

// List attendance by class, subject, and date
export const listByClassSubjectDate = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("studentAttendanceLogs")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
          .eq("tanggal", args.tanggal)
      )
      .first();
    return flattenLog(res);
  },
});

// List attendance by class and date (all subjects)
export const listByClassDate = query({
  args: {
    classId: v.id("classes"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("studentAttendanceLogs")
      .filter(q => q.and(
        q.eq(q.field("classId"), args.classId),
        q.eq(q.field("tanggal"), args.tanggal)
      ))
      .collect();
    
    return logs.flatMap(l => flattenLog(l));
  },
});

// Monthly recap by class and subject (Optimized)
export const rekapBulanan = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    bulan: v.string(), // "2026-03"
  },
  handler: async (ctx, args) => {
    const allLogs = await ctx.db
      .query("studentAttendanceLogs")
      .withIndex("by_class_subject_date", (q) =>
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .collect();

    // Filter by month and flatten
    return allLogs
      .filter((r) => r.tanggal.startsWith(args.bulan))
      .flatMap(l => flattenLog(l));
  },
});

// Get attendance for a specific student in a month
export const rekapSiswa = query({
  args: {
    studentId: v.string(),
    bulan: v.string(),
  },
  handler: async (ctx, args) => {
    // This is the most expensive query now, but manageable
    const allLogs = await ctx.db.query("studentAttendanceLogs").collect();
    
    return allLogs
      .filter(l => l.tanggal.startsWith(args.bulan) && l.logs[args.studentId])
      .map(l => {
        const entry = l.logs[args.studentId];
        return {
          studentId: args.studentId,
          schoolId: l.schoolId,
          classId: l.classId,
          subjectId: l.subjectId,
          tanggal: l.tanggal,
          status: entry.status,
          keterangan: entry.keterangan || "",
          updatedAt: entry.updatedAt
        };
      });
  },
});

// List all attendance by school and date
export const listBySchoolDate = query({
  args: {
    schoolId: v.id("schools"),
    tanggal: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("studentAttendanceLogs")
      .withIndex("by_school_date", (q) =>
        q.eq("schoolId", args.schoolId).eq("tanggal", args.tanggal)
      )
      .collect();
    return logs.flatMap(l => flattenLog(l));
  },
});

// Get detailed monthly report for a class and subject (Matrix format)
export const getMonthlyClassReport = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    bulan: v.string(), // "2026-03"
  },
  handler: async (ctx, args) => {
    // 1. Get all students in this class
    const classInfo = await ctx.db.get(args.classId);
    if (!classInfo) return { error: "Kelas tidak ditemukan" };

    const school = await ctx.db.get(classInfo.schoolId);
    if (!school) return { error: "Sekolah tidak ditemukan" };

    const students = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("namaSekolah", school.nama))
      .collect()
      .then(res => res.filter(s => s.kelas === classInfo.nama && (s as any).status !== "Lulus"));

    // 2. Fetch all logs for this class/subject
    const monthlyLogs = await ctx.db
      .query("studentAttendanceLogs")
      .withIndex("by_class_subject_date", (q) => 
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .collect()
      .then(logs => logs.filter(l => l.tanggal.startsWith(args.bulan)));

    // 3. Build a map of [studentId][date] = status
    const attendanceMap: Record<string, Record<string, string>> = {};
    monthlyLogs.forEach(log => {
      Object.entries(log.logs || {}).forEach(([sid, entry]: [string, any]) => {
        if (!attendanceMap[sid]) attendanceMap[sid] = {};
        attendanceMap[sid][log.tanggal] = entry.status;
      });
    });

    return {
      students: students.map(s => ({
        id: s._id,
        nisn: s.nisn,
        nama: s.nama,
      })),
      attendance: attendanceMap,
      className: classInfo.nama,
    };
  },
});
