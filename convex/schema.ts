import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Teachers table
  teachers: defineTable({
    nuptk: v.any(),
    nama: v.any(),
    nip: v.optional(v.any()),
    jenisKelamin: v.optional(v.any()),
    tempatLahir: v.optional(v.any()),
    tanggalLahir: v.optional(v.any()),
    pendidikanTerakhir: v.optional(v.any()),
    mapel: v.optional(v.any()),
    unitKerja: v.optional(v.any()), 
    schoolId: v.optional(v.id("schools")), 
    kecamatan: v.optional(v.any()),
    status: v.optional(v.any()),
    tmt: v.optional(v.any()), 
    isCertified: v.optional(v.any()),
    phoneNumber: v.optional(v.any()),
    email: v.optional(v.any()),
    isActive: v.optional(v.any()),
    isVerified: v.optional(v.any()), 
    isSkGenerated: v.optional(v.any()), 
    pdpkpnu: v.optional(v.any()),
    photoId: v.optional(v.any()),
    suratPermohonanUrl: v.optional(v.any()), 
    ktaNumber: v.optional(v.any()),
    createdAt: v.any(),
    updatedAt: v.any(),
  })
    .index("by_nuptk", ["nuptk"])
    .index("by_unit", ["unitKerja"])
    .index("by_kecamatan", ["kecamatan"])
    .index("by_active", ["isActive"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_schoolId", ["schoolId"]) 
    // .index("by_schoolId", ["schoolId"]) 
    .index("by_school_active", ["schoolId", "isActive"]) 
    .searchIndex("search_teacher", {
      searchField: "nama",
      filterFields: ["isActive", "unitKerja", "kecamatan"], 
    }),

  // Students table
  students: defineTable({
    nisn: v.any(),
    nik: v.optional(v.any()), 
    nomorIndukMaarif: v.optional(v.any()),
    nama: v.any(),
    jenisKelamin: v.optional(v.any()),
    tempatLahir: v.optional(v.any()),
    tanggalLahir: v.optional(v.any()),
    namaAyah: v.optional(v.any()), 
    namaIbu: v.optional(v.any()), 
    alamat: v.optional(v.any()),
    kecamatan: v.optional(v.any()),
    namaSekolah: v.optional(v.any()),
    npsn: v.optional(v.any()), 
    kelas: v.optional(v.any()),
    nomorTelepon: v.optional(v.any()),
    namaWali: v.optional(v.any()),
    createdAt: v.any(),
    updatedAt: v.any(),
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
    nsm: v.any(),
    npsn: v.optional(v.any()),
    nama: v.any(),
    alamat: v.optional(v.any()),
    kecamatan: v.optional(v.any()),
    telepon: v.optional(v.any()),
    email: v.optional(v.any()),
    kepalaMadrasah: v.optional(v.any()),
    akreditasi: v.optional(v.any()),
    statusJamiyyah: v.optional(v.any()), 
    createdAt: v.any(),
    updatedAt: v.any(),
  })
    .index("by_nsm", ["nsm"])
    .index("by_kecamatan", ["kecamatan"])
    .searchIndex("search_schools", {
      searchField: "nama",
      filterFields: ["kecamatan"],
    }),

  // Users table for authentication
  users: defineTable({
    email: v.any(),
    name: v.any(),
    passwordHash: v.any(),
    role: v.any(), 
    unit: v.optional(v.any()), 
    schoolId: v.optional(v.id("schools")), 
    isActive: v.any(),
    createdAt: v.any(),
    updatedAt: v.any(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Settings table (Global App Settings) - Force Sync
  settings: defineTable({
      key: v.any(), 
      value: v.optional(v.any()), 
      storageId: v.optional(v.any()), 
      mimeType: v.optional(v.any()),
      schoolId: v.optional(v.any()), 
      updatedAt: v.any(),
  }).index("by_key", ["key"]),

  // NEW Settings Table (V2) - Fresh Start
  settings_v2: defineTable({
      key: v.any(), 
      value: v.any(), 
      mimeType: v.any(),
      schoolId: v.optional(v.any()), 
      updatedAt: v.any(),
  }).index("by_key", ["key"]),

  // SK (Surat Keputusan) documents
  skDocuments: defineTable({
    nomorSk: v.any(),
    jenisSk: v.any(), 
    teacherId: v.optional(v.any()),
    nama: v.any(),
    jabatan: v.optional(v.any()),
    unitKerja: v.optional(v.any()), 
    schoolId: v.optional(v.id("schools")), 
    tanggalPenetapan: v.any(),
    status: v.any(), 
    fileUrl: v.optional(v.any()),
    suratPermohonanUrl: v.optional(v.any()), 
    qrCode: v.optional(v.any()),
    createdBy: v.optional(v.any()), 
    archivedAt: v.optional(v.any()), 
    archivedBy: v.optional(v.any()), 
    archiveReason: v.optional(v.any()), 
    createdAt: v.any(),
    updatedAt: v.any(),
   })
     .index("by_teacher", ["teacherId"])
     .index("by_status", ["status"])
     .index("by_jenis", ["jenisSk"])
     .index("by_nomor", ["nomorSk"])
     .index("by_archived", ["archivedAt"])
     .searchIndex("search_sk", {
       searchField: "nama",
       filterFields: ["status", "nomorSk"], 
     }),
 
   // Headmaster Tenures (Pengangkatan Kepala Madrasah)
   headmasterTenures: defineTable({
     teacherId: v.any(),
     teacherName: v.any(), 
     schoolId: v.any(), 
     schoolName: v.any(), 
     periode: v.any(), 
     startDate: v.any(),
     endDate: v.any(),
    status: v.any(), 
    nomorSk: v.optional(v.any()), 
    skUrl: v.optional(v.any()),
    approvedBy: v.optional(v.any()),
    approvedAt: v.optional(v.any()),
    createdBy: v.any(),
    createdAt: v.any(),
    updatedAt: v.any(),
  })
    .index("by_teacher", ["teacherId"])
    // .index("by_school", ["schoolId"])
    .index("by_status", ["status"])
    .index("by_periode", ["periode"]),

  // Dashboard stats cache (for performance)
  dashboardStats: defineTable({
    totalTeachers: v.any(),
    totalStudents: v.any(),
    totalSchools: v.any(),
    totalSk: v.any(),
    lastUpdated: v.any(),
  }),

  // Notifications table
  notifications: defineTable({
    userId: v.any(),        
    type: v.any(),              
    title: v.any(),             
    message: v.any(),           
    isRead: v.any(),           
    metadata: v.optional(v.any()),
    createdAt: v.any(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_created", ["createdAt"]),

  // Activity Logs for Audit Trail
  activity_logs: defineTable({
    user: v.any(),
    role: v.any(),
    action: v.any(),
    details: v.any(),
    timestamp: v.any(),
  })
    .index("by_timestamp", ["timestamp"]),

  // Approval history for audit trail
  approvalHistory: defineTable({
    documentId: v.any(),  
    documentType: v.any(),  
    action: v.any(),  
    fromStatus: v.optional(v.any()),  
    toStatus: v.optional(v.any()),  
    performedBy: v.any(),  
    performedAt: v.any(),  
    comment: v.optional(v.any()),  
    metadata: v.optional(v.any()),
  })
    .index("by_document", ["documentId"])
    .index("by_document_type", ["documentType"])
    .index("by_user", ["performedBy"])
    .index("by_date", ["performedAt"]),

  // Sessions for Secure Authentication
  sessions: defineTable({
    token: v.any(), 
    userId: v.any(),
    expiresAt: v.any(),
    ipAddress: v.optional(v.any()),
    userAgent: v.optional(v.any()),
    createdAt: v.any(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Archive Digital SK Lama
  sk_archives: defineTable({
    schoolId: v.any(),
    nomorSk: v.any(),
    title: v.any(),
    year: v.any(),
    category: v.any(), 
    storageId: v.any(), 
    fileUrl: v.any(),   
    uploadedBy: v.any(),
    createdAt: v.any(),
  })
    .index("by_school", ["schoolId"])
    .index("by_year", ["year"]),

  // Teacher Mutations (History)
  teacher_mutations: defineTable({
    teacherId: v.any(),
    fromUnit: v.any(),
    toUnit: v.any(),
    reason: v.any(),
    skNumber: v.any(),
    effectiveDate: v.any(),
    performedBy: v.any(),
    createdAt: v.any(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_unit_from", ["fromUnit"])
    .index("by_unit_to", ["toUnit"])
    .index("by_date", ["createdAt"]), 
});
