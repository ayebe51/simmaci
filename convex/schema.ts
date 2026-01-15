import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Teachers table
  teachers: defineTable({
    nuptk: v.string(),
    nama: v.string(),
    nip: v.optional(v.string()),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    pendidikanTerakhir: v.optional(v.string()),
    mapel: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    status: v.optional(v.string()),
    isCertified: v.optional(v.boolean()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    pdpkpnu: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_nuptk", ["nuptk"])
    .index("by_unit", ["unitKerja"])
    .index("by_kecamatan", ["kecamatan"])
    .index("by_active", ["isActive"]),

  // Students table
  students: defineTable({
    nisn: v.string(),
    nomorIndukMaarif: v.optional(v.string()),
    nama: v.string(),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    namaSekolah: v.optional(v.string()),
    kelas: v.optional(v.string()),
    nomorTelepon: v.optional(v.string()),
    namaWali: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_nisn", ["nisn"])
    .index("by_school", ["namaSekolah"])
    .index("by_kecamatan", ["kecamatan"]),

  // Schools table
  schools: defineTable({
    nsm: v.string(),
    npsn: v.optional(v.string()),
    nama: v.string(),
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    telepon: v.optional(v.string()),
    email: v.optional(v.string()),
    kepalaMadrasah: v.optional(v.string()),
    akreditasi: v.optional(v.string()),
    statusJamiyyah: v.optional(v.string()), // Jam'iyyah, Jamaah (Afiliasi), etc.
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_nsm", ["nsm"])
    .index("by_kecamatan", ["kecamatan"]),

  // Users table for authentication
  users: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    role: v.string(), // 'admin', 'operator', 'viewer'
    unit: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // SK (Surat Keputusan) documents
  skDocuments: defineTable({
    nomorSk: v.string(),
    jenisSk: v.string(), // 'gty', 'gtt', 'kamad', 'tendik'
    teacherId: v.optional(v.id("teachers")),
    nama: v.string(),
    jabatan: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    tanggalPenetapan: v.string(),
    status: v.string(), // 'draft', 'active', 'archived'
    fileUrl: v.optional(v.string()),
    qrCode: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_status", ["status"])
    .index("by_jenis", ["jenisSk"])
    .index("by_nomor", ["nomorSk"]),

  // Headmaster Tenures (Pengangkatan Kepala Madrasah)
  headmasterTenures: defineTable({
    teacherId: v.id("teachers"),
    teacherName: v.string(), // Denormalized for quick access
    schoolId: v.id("schools"),
    schoolName: v.string(), // Denormalized for quick access
    periode: v.number(), // Periode ke- (1, 2, 3, etc.)
    startDate: v.string(),
    endDate: v.string(),
    status: v.string(), // 'pending', 'approved', 'rejected', 'active', 'expired'
    skUrl: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_school", ["schoolId"])
    .index("by_status", ["status"])
    .index("by_periode", ["periode"]),

  // Dashboard stats cache (for performance)
  dashboardStats: defineTable({
    totalTeachers: v.number(),
    totalStudents: v.number(),
    totalSchools: v.number(),
    totalSk: v.number(),
    lastUpdated: v.number(),
  }),
});
