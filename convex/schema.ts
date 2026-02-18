import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Teachers table
  // Teachers table (RELAXED FOR DIAGNOSIS)
  teachers: defineTable(v.any()),

  // Teacher Documents (Archive)
  // Teacher Documents Archive (Brankas Arsip)

  // Teacher Documents (Archive) - REMOVED due to instability
  // teacher_archives: defineTable({...}),

  // Students table
  students: defineTable({
    nisn: v.string(),
    nik: v.optional(v.string()), // New: NIK
    nomorIndukMaarif: v.optional(v.string()),
    nama: v.string(),
    jenisKelamin: v.optional(v.string()),
    tempatLahir: v.optional(v.string()),
    tanggalLahir: v.optional(v.string()),
    namaAyah: v.optional(v.string()), // New: Nama Ayah
    namaIbu: v.optional(v.string()), // New: Nama Ibu
    alamat: v.optional(v.string()),
    kecamatan: v.optional(v.string()),
    namaSekolah: v.optional(v.string()),
    npsn: v.optional(v.string()), // New: NPSN
    kelas: v.optional(v.string()),
    nomorTelepon: v.optional(v.string()),
    namaWali: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_nisn", ["nisn"])
    .index("by_school", ["namaSekolah"])
    .index("by_kecamatan", ["kecamatan"])
    .searchIndex("search_students", {
      searchField: "nama",
      filterFields: ["namaSekolah", "kecamatan", "nisn"],
    }),

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
  // Users table (RELAXED FOR DIAGNOSIS)
  users: defineTable(v.any()),



  // Settings table (Global App Settings) - Force Sync
  settings: defineTable({
      key: v.string(), // e.g. "sk_template_gty"
      value: v.optional(v.string()), // For small text settings
      storageId: v.optional(v.id("_storage")), // For Files (Templates)
      mimeType: v.optional(v.string()),
      schoolId: v.optional(v.any()), // Relaxed to ANY for debugging
      updatedAt: v.number(),
  }).index("by_key", ["key"]),
    // .index("by_schoolId", ["schoolId"]), // DISABLED FOR MIGRATION

  // NEW Settings Table (V2) - Fresh Start
  settings_v2: defineTable({
      key: v.string(), 
      value: v.string(), // Base64 Content (Required in V2)
      mimeType: v.string(),
      schoolId: v.optional(v.any()), // Relaxed to ANY for debugging
      updatedAt: v.number(),
  }).index("by_key", ["key"]),
    // .index("by_schoolId", ["schoolId"]), // DISABLED FOR MIGRATION

  // SK (Surat Keputusan) documents
  // SK Documents (RELAXED FOR DIAGNOSIS)
  skDocuments: defineTable(v.any()),
 
   // Headmaster Tenures (Pengangkatan Kepala Madrasah)
   headmasterTenures: defineTable({
     teacherId: v.id("teachers"),
     teacherName: v.string(), // Denormalized for quick access
     schoolId: v.union(v.string(), v.id("schools")), // Relaxed for legacy data
     schoolName: v.string(), // Denormalized for quick access
     periode: v.number(), // Periode ke- (1, 2, 3, etc.)
     startDate: v.string(),
     endDate: v.string(),
    status: v.string(), // 'pending', 'approved', 'rejected', 'active', 'expired'
    nomorSk: v.optional(v.string()), // Saved generated SK Number
    skUrl: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_teacher", ["teacherId"])
    // .index("by_school", ["schoolId"])
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
