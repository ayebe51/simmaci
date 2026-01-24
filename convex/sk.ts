import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all SK documents with optional filters
export const list = query({
  args: {
    jenisSk: v.optional(v.string()),
    status: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let docs = await ctx.db.query("skDocuments").collect();
    
    // Filter out archived SK (so Reset Data works)
    docs = docs.filter(sk => sk.status !== "archived");
    
    // Apply filters
    if (args.jenisSk && args.jenisSk !== "all") {
      docs = docs.filter(sk => sk.jenisSk === args.jenisSk);
    }
    
    if (args.status && args.status !== "all") {
      docs = docs.filter(sk => sk.status === args.status);
    }
    
    if (args.unitKerja) {
      docs = docs.filter(sk => sk.unitKerja === args.unitKerja);
    }
    
    return docs;
  },
});

// Get single SK by ID
export const get = query({
  args: { id: v.id("skDocuments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get SK by nomor
export const getByNomor = query({
  args: { nomorSk: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skDocuments")
      .withIndex("by_nomor", (q) => q.eq("nomorSk", args.nomorSk))
      .first();
  },
});

// Get SK by teacher ID
export const getByTeacher = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skDocuments")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .collect();
  },
});

// Create new SK
export const create = mutation({
  args: {
    nomorSk: v.string(),
    jenisSk: v.string(),
    teacherId: v.optional(v.id("teachers")),
    nama: v.string(),
    jabatan: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    tanggalPenetapan: v.string(),
    status: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    qrCode: v.optional(v.string()),
    createdBy: v.optional(v.string()), // 🔥 CHANGED to optional string (fix for bulk upload)
  },
  handler: async (ctx, args) => {
    try {
        const now = Date.now();
        
        // Check if nomor SK already exists
        const existing = await ctx.db
          .query("skDocuments")
          .withIndex("by_nomor", (q) => q.eq("nomorSk", args.nomorSk))
          .first();
        
        let finalNomorSk = args.nomorSk;
        if (existing) {
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          finalNomorSk = `${args.nomorSk}-${randomSuffix}`;
          console.warn(`Duplicate SK Number detected: ${args.nomorSk}. Auto-resolved to: ${finalNomorSk}`);
        }
        
        return await ctx.db.insert("skDocuments", {
          ...args,
          nomorSk: finalNomorSk,
          status: args.status || "draft",
          createdAt: now,
          updatedAt: now,
        });
    } catch (err: any) {
        console.error("SK Creation Failed:", err);
        throw new Error(`Gagal membuat SK: ${err.message}`);
    }
  },
});

// Bulk create SK (for batch generation)
export const bulkCreate = mutation({
  args: {
    documents: v.array(v.object({
      nomorSk: v.string(),
      jenisSk: v.string(),
      teacherId: v.optional(v.id("teachers")),
      nama: v.string(),
      jabatan: v.optional(v.string()),
      unitKerja: v.optional(v.string()),
      tanggalPenetapan: v.string(),
      status: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      qrCode: v.optional(v.string()),
    })),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results = [];
    
    for (const doc of args.documents) {
      // Check duplicates
      const existing = await ctx.db
        .query("skDocuments")
        .withIndex("by_nomor", (q) => q.eq("nomorSk", doc.nomorSk))
        .first();
      
      if (!existing) {
        const id = await ctx.db.insert("skDocuments", {
          ...doc,
          status: doc.status || "active",
          createdBy: args.createdBy,
          createdAt: now,
          updatedAt: now,
        });
        results.push(id);
      }
    }
    
    return { count: results.length, ids: results };
  },
});

// Update SK
export const update = mutation({
  args: {
    id: v.id("skDocuments"),
    nomorSk: v.optional(v.string()),
    jenisSk: v.optional(v.string()),
    teacherId: v.optional(v.id("teachers")),
    nama: v.optional(v.string()),
    jabatan: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    tanggalPenetapan: v.optional(v.string()),
    status: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    qrCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    
    return id;
  },
});

// Archive SK (soft delete)
export const archive = mutation({
  args: { id: v.id("skDocuments") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});

// Archive all SK documents (for reset functionality)
export const archiveAll = mutation({
  args: {},
  handler: async (ctx) => {
    const allDocs = await ctx.db.query("skDocuments").collect();
    const now = Date.now();
    
    for (const doc of allDocs) {
      await ctx.db.patch(doc._id, {
        status: "archived",
        updatedAt: now,
      });
    }
    
    return { count: allDocs.length };
  },
});

// Batch update SK status (for batch approval/rejection)
export const batchUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("skDocuments")),
    status: v.string(), // "approved" or "rejected"
    rejectionReason: v.optional(v.string()),
    currentUserId: v.optional(v.id("users")), // For notifications
  },
  handler: async (ctx, args) => {
    const updatedCount = args.ids.length;
    
    for (const id of args.ids) {
      const sk = await ctx.db.get(id);
      if (!sk) continue;
      
      const updateData: any = {
        status: args.status,
        updatedAt: Date.now(),
      };
      
      // Add rejection reason if provided
      if (args.status === "rejected" && args.rejectionReason) {
        updateData.rejectionReason = args.rejectionReason;
      }
      
      await ctx.db.patch(id, updateData);
      
      // 🔔 Notification: Notify SK creator
      if (sk.createdBy && args.status !== "draft") {
        try {
          const users = await ctx.db.query("users").collect();
          const targetUser = users.find(u => u.email === sk.createdBy || u._id === sk.createdBy);
          
          if (targetUser) {
            const type = args.status === "approved" ? "sk_approved" : "sk_rejected";
            const title = args.status === "approved" ? "SK Disetujui" : "SK Ditolak";
            let message = `SK No. ${sk.nomorSk} untuk ${sk.nama} telah ${args.status === "approved" ? "disetujui" : "ditolak"}`;
            
            if (args.status === "rejected" && args.rejectionReason) {
              message += `: ${args.rejectionReason}`;
            }
            
            await ctx.db.insert("notifications", {
              userId: targetUser._id,
              type,
              title,
              message,
              isRead: false,
              metadata: { skId: id, rejectionReason: args.rejectionReason },
              createdAt: Date.now(),
            });
          }
        } catch (error) {
          console.error("Notification error:", error);
        }
      }
    }
    
    // 🔔 Notification: Batch summary to current user
    if (args.currentUserId && updatedCount > 0) {
      try {
        await ctx.db.insert("notifications", {
          userId: args.currentUserId,
          type: "batch_complete",
          title: "Batch Operation Selesai",
          message: `${updatedCount} SK berhasil di-${args.status === "approved" ? "setujui" : "tolak"}`,
          isRead: false,
          metadata: { batchCount: updatedCount },
          createdAt: Date.now(),
        });
      } catch (error) {
        console.error("Batch notification error:", error);
      }
    }
    
    return { count: updatedCount };
  },
});

// Get SK count by status
export const countByStatus = query({
  args: {
    status: v.optional(v.string()),
    jenisSk: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let docs = await ctx.db.query("skDocuments").collect();
    
    if (args.status) {
      docs = docs.filter(sk => sk.status === args.status);
    }
    
    if (args.jenisSk) {
      docs = docs.filter(sk => sk.jenisSk === args.jenisSk);
    }
    
    return docs.length;
  },
});

// Get teachers who have SK (for SK Generator filtering)
// Only teachers who have submitted SK will appear in generator
export const getTeachersWithSk = query({
  args: {},
  handler: async (ctx) => {
    // Get all SK documents
    const allSk = await ctx.db.query("skDocuments").collect();
    
    // Extract unique teacher IDs
    const teacherIds = [...new Set(
      allSk
        .filter(sk => sk.teacherId) // Only SK with teacherId
        .map(sk => sk.teacherId!)
    )];
    
    // Fetch teacher details
    const teachers = await Promise.all(
      teacherIds.map(async (id) => {
        const teacher = await ctx.db.get(id);
        return teacher;
      })
    );
    
    // Filter out null values (deleted teachers)
    return teachers.filter((t): t is NonNullable<typeof t> => t !== null);
  },
});

export const getQueuedSk = query({
  args: {},
  handler: async (ctx) => {
    // Get SKs that are 'draft' or 'new'
    const sks = await ctx.db.query("skDocuments").collect();
    const pendingSks = sks.filter(sk => sk.status === "approved" || sk.status === "verified");

    const results = [];
    for (const sk of pendingSks) {
       if (!sk.teacherId) continue;
       const teacher = await ctx.db.get(sk.teacherId);
       if (!teacher) continue;

       // Merge teacher and SK data
       // We use SK ID as the primary row ID for the generator queue
       results.push({
          ...teacher, // flattened teacher properties
          // Explicitly map properties that might overlap or be needed specifically
          _id: sk._id,           // IMPORTANT: Row ID is the SK Document ID
          teacherId: teacher._id,// Keep reference to real teacher ID
          
          // SK Specifics
          skId: sk._id,
          jenisSk: sk.jenisSk,
          skStatus: sk.status,
          nomorSkDraft: sk.nomorSk, // Draft number if exists
          
          updatedAt: sk.updatedAt,
       });
    }
    
    // Sort by newest
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }
});
