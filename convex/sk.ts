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
      
      if (existing) {
        console.log(`Duplicate Nomor SK: ${args.nomorSk}, Updating existing record...`);
        // UPSERT LOGIC: Update existing instead of throwing
        await ctx.db.patch(existing._id, {
            ...args,
            updatedAt: now,
            // Keep original createdAt and createdBy if not provided?
            // Overwriting is safer for "regeneration" context
        });
        return existing._id;
      }
      
      const newId = await ctx.db.insert("skDocuments", {
        ...args,
        status: args.status || "draft",
        createdAt: now,
        updatedAt: now,
      });
      return newId;
    } catch (e: any) {
      console.error("SK Create Error Details:", {
        args,
        error: e.message,
        stack: e.stack
      });
      throw e; // Re-throw to be caught by client
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
    createdBy: v.string(), // Changed from v.id("users") to v.string() to match schema and single create
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results = [];
    const errors = [];
    
    console.log(`Starting bulkCreate for ${args.documents.length} documents by ${args.createdBy}`);
    
    try {
      for (const doc of args.documents) {
        try {
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
          } else {
            console.log(`Skipping duplicate SK: ${doc.nomorSk}`);
          }
        } catch (innerError: any) {
          console.error(`Error processing SK ${doc.nomorSk}:`, innerError);
          errors.push({ nomor: doc.nomorSk, error: innerError.message });
        }
      }
      
      console.log(`Bulk Create finished. Created: ${results.length}, Errors: ${errors.length}`);
      
      // If we have mixed results, we return success count, but maybe we should warn?
      // For now, return standard format.
      return { count: results.length, ids: results, errors: errors.length > 0 ? errors : undefined };
      
    } catch (e: any) {
      console.error("Critical Error in bulkCreate:", e);
      throw new Error(`Bulk Create Failed: ${e.message}`);
    }
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

// Hard delete all SK documents (for true cleanup)
export const cleanupAll = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting cleanupAll...");
    try {
      const allDocs = await ctx.db.query("skDocuments").collect();
      console.log(`Found ${allDocs.length} documents to delete.`);
      
      let deleted = 0;
      for (const doc of allDocs) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
      console.log(`Successfully deleted ${deleted} documents.`);
      
      return { count: allDocs.length };
    } catch (e: any) {
      console.error("Error in cleanupAll:", e);
      throw new Error(`Delete failed: ${e.message}`);
    }
  },
});

export const testHello = query({
  args: {},
  handler: async () => {
    return "Hello from SK module";
  }
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
      
      // 🔥 LINK: Verify Teacher when SK is Approved
      if (args.status === "approved" && sk.teacherId) {
          await ctx.db.patch(sk.teacherId, { isVerified: true });
      } else if (args.status === "rejected" && sk.teacherId) {
          await ctx.db.patch(sk.teacherId, { isVerified: false });
      }
      
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

// Delete teacher (used by SK Generator queue cleanup)
export const deleteTeacher = mutation({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    const exists = await ctx.db.get(args.id);
    if (exists) {
        await ctx.db.delete(args.id);
    }
  },
});

export const deleteAllTeachers = mutation({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    for (const t of teachers) {
      await ctx.db.delete(t._id);
    }
  },
});

// Get teachers (The Queue for SK Generation)
export const getTeachersWithSk = query({
  args: {
    isVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // fetches ALL teachers, sorted by Most Recently Updated
    // BEST PRACTICE: Use Database Index for Scalability (Not Memory Sort)
    const teachers = await ctx.db
        .query("teachers")
        .withIndex("by_updatedAt")
        .order("desc")
        .collect();
    
    // 1. Filter out teachers who already have SK generated (Soft Cleanup)
    // DISABLED: User wants to see uploaded data even if previously generated (UPSERT case)
    // We let the Frontend decide what to show, or rely on "Verification" status if needed.
    // For now, RETURN ALL ACTIVE TEACHERS to solve visibility issues.
    let filteredTeachers = teachers; 
    
    // Optional: Filter only Active?
    filteredTeachers = filteredTeachers.filter(t => t.isActive !== false);

    // 2. Filter based on verification status if provided
    /* 
    DISABLED FOR COMPATIBILITY: Frontend might still be sending { isVerified: true } from cached version.
    We force ignore this filter to ensure the "Bypass Inbox" workflow works immediately.
    
    if (args.isVerified !== undefined) {
        filteredTeachers = filteredTeachers.filter(t => {
            const isVerified = t.isVerified === true; 
            return isVerified === args.isVerified;
        });
    }
    */
    
    return filteredTeachers;
  },
});

// Mark teacher as having SK generated (Available for historical record but hidden from generator)
export const markTeacherAsGenerated = mutation({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { isSkGenerated: true });

    // Log the activity
    if (teacher) {
        await ctx.db.insert("activity_logs", {
            user: "System",
            role: "system",
            action: "Generate SK",
            details: `SK Generated for ${teacher.nama}`,
            timestamp: Date.now(),
        });
    }
  },
});

// Verify Teacher (Move from Dashboard to Generator)
export const verifyTeacher = mutation({
  args: { id: v.id("teachers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isVerified: true });
  },
});

// Reject teacher (from Queue) with feedback
export const rejectTeacher = mutation({
  args: { 
    id: v.id("teachers"), 
    reason: v.string(),
    rejectedBy: v.optional(v.id("users"))
  },
  handler: async (ctx, args) => {
    // 1. Get teacher data
    const teacher = await ctx.db.get(args.id);
    if (!teacher) throw new Error("Teacher not found");

    // 2. Mark as NOT verified (ensure false)
    await ctx.db.patch(args.id, { 
        isVerified: false,
        // We might want to add a status field on teacher later like 'verificationStatus': 'rejected'
        // For now, rely on notifications or Activity Log
    });

    // 3. Send Notification to Operator/Creator if possible?
    // Since Teacher table doesn't track "createdBy" user ID (yet), we might need to rely on "Unit Kerja" match or later add createdBy.
    // For now, maybe just Log it. Or if we have email.
    
    // 4. Log Activity
    await ctx.db.insert("activity_logs", {
        user: args.rejectedBy ? "Admin" : "System",
        role: "admin",
        action: "Reject Verification",
        details: `Rejection for ${teacher.nama}: ${args.reason}`,
        timestamp: Date.now(),
    });

    // 5. Store "Rejection Reason" on Teacher?
    // Maybe we need a `metadata` or `verificationNote` field on Teacher?
    // Let's assume we don't modify schema too much.
  },
});

export const bulkVerifyTeachers = mutation({
  args: { ids: v.array(v.id("teachers")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
        await ctx.db.patch(id, { isVerified: true });
    }
  },
});

export const deleteAllSk = mutation({
  args: {},
  handler: async (ctx) => {
    const sks = await ctx.db.query("skDocuments").collect();
    for (const sk of sks) {
      await ctx.db.delete(sk._id);
    }
    return { count: sks.length };
  },
});


export const debugListAllTeachers = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("teachers").collect();
    }
});
