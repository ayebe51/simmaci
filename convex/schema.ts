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
    tmt: v.optional(v.string()),  // Tanggal Mulai Tugas
    isCertified: v.optional(v.boolean()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()), // For SK Verification Workflow
    isSkGenerated: v.optional(v.boolean()), // Status: SK Generated? (Soft Delete from Queue)
    pdpkpnu: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    ktaNumber: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_nuptk", ["nuptk"])
    .index("by_unit", ["unitKerja"])
    .index("by_kecamatan", ["kecamatan"])
    .index("by_active", ["isActive"]),

  // Teacher Documents (Archive)
  // Teacher Documents Archive (Brankas Arsip)

  // Teacher Documents (Archive) - REMOVED due to instability
  // teacher_archives: defineTable({...}),

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
    .index("by_kecamatan", ["kecamatan"])
    .searchIndex("search_schools", {
      searchField: "nama",
      filterFields: ["kecamatan"],
    }),

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



  // Settings table (Global App Settings)
  settings: defineTable({
      key: v.string(), // e.g. "sk_template_gty"
      value: v.optional(v.string()), // For small text settings
      storageId: v.optional(v.id("_storage")), // For Files (Templates)
      mimeType: v.optional(v.string()),
      updatedAt: v.number(),
  }).index("by_key", ["key"]),

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
    createdBy: v.optional(v.string()), // Optional string to support bulk upload
    // Archive metadata
    archivedAt: v.optional(v.number()), // Timestamp when archived
    archivedBy: v.optional(v.id("users")), // Who archived it
    archiveReason: v.optional(v.string()), // Optional reason for archiving
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_status", ["status"])
    .index("by_jenis", ["jenisSk"])
    .index("by_nomor", ["nomorSk"])
    .index("by_archived", ["archivedAt"]),

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

  // Notifications table
  notifications: defineTable({
    userId: v.id("users"),        // Recipient
    type: v.string(),              // 'sk_submitted', 'sk_approved', 'sk_rejected', 'batch_complete'
    title: v.string(),             // "SK Disetujui"
    message: v.string(),           // "SK No. 123 telah disetujui"
    isRead: v.boolean(),           // Read status
    metadata: v.optional(v.object({
      skId: v.optional(v.id("skDocuments")),
      batchCount: v.optional(v.number()),
      rejectionReason: v.optional(v.string()),
    })),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_created", ["createdAt"]),

  // Activity Logs for Audit Trail
  activity_logs: defineTable({
    user: v.string(),
    role: v.string(),
    action: v.string(),
    details: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"]),

  // Approval history for audit trail
  approvalHistory: defineTable({
    documentId: v.string(),  // Generic to support any document type
    documentType: v.string(),  // 'sk', 'headmaster', etc.
    action: v.string(),  // 'submit', 'approve', 'reject', 'comment', 'update'
    fromStatus: v.optional(v.string()),  // Previous status
    toStatus: v.optional(v.string()),  // New status
    performedBy: v.id("users"),  // Who performed the action
    performedAt: v.number(),  // When
    comment: v.optional(v.string()),  // Optional comment/reason
    metadata: v.optional(v.object({
      rejectionReason: v.optional(v.string()),
      changes: v.optional(v.string()),  // JSON string of changes
    })),
  })
    .index("by_document", ["documentId"])
    .index("by_document_type", ["documentType"])
    .index("by_user", ["performedBy"])
    .index("by_date", ["performedAt"]),

  // Sessions for Secure Authentication
  sessions: defineTable({
    token: v.string(), // UUID or Custom Token
    userId: v.id("users"),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Archive Digital SK Lama
  sk_archives: defineTable({
    schoolId: v.id("schools"),
    nomorSk: v.string(),
    title: v.string(),
    year: v.string(),
    category: v.string(), // 'sk_kepala', 'sk_guru', 'other'
    storageId: v.string(), // Convex Storage ID
    fileUrl: v.string(),   // Public URL for easy access
    uploadedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_year", ["year"]),

  // Teacher Mutations (History)
  teacher_mutations: defineTable({
    teacherId: v.id("teachers"),
    fromUnit: v.string(),
    toUnit: v.string(),
    reason: v.string(),
    skNumber: v.string(),
    effectiveDate: v.string(),
    performedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_unit_from", ["fromUnit"])
    .index("by_unit_to", ["toUnit"])
    .index("by_date", ["createdAt"]), // To show recent mutations
});