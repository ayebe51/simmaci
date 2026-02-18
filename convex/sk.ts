import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get all SK documents with server-side pagination
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    jenisSk: v.optional(v.string()),
    status: v.optional(v.string()),
    unitKerja: v.optional(v.string()), // Optional Admin Filter
    schoolId: v.optional(v.id("schools")), // Explicit School Filter
    search: v.optional(v.string()), // NEW: Search Term
    // Context args (optional, can generally be derived from auth)
    userRole: v.optional(v.string()), 
    userUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Auth & RBAC
    const identity = await ctx.auth.getUserIdentity();
    
    let userRole = args.userRole;
    let userSchoolId = args.schoolId;
    let userUnit = args.userUnit; // From Client

    if (identity) {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();
        
        if (user) {
            userRole = user.role;
            userSchoolId = user.schoolId;
            userUnit = user.unit;
        }
    }

    // Default to "viewer" if no role found, but don't crash
    if (!userRole) {
         // console.warn("sk:list called without identity or userRole");
         // return { page: [], isDone: true, continueCursor: "" };
         // For debugging, we might allow it or just treat as empty
    }

    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    const isSuper = userRole ? superRoles.includes(userRole) : false;

    // 2. Determine Scope (School ID)
    let targetSchoolId = args.schoolId; // If passed explicitly

    // If Admin passed unitKerja string, try to resolve it to ID
    if (isSuper && args.unitKerja && !targetSchoolId) {
         targetSchoolId = await resolveSchoolId(ctx, args.unitKerja);
    }

    if (!isSuper) {
        if (userRole === "operator") {
            // Operator is STRICTLY limited to their school
            if (userSchoolId) {
                targetSchoolId = userSchoolId;
            } else if (userUnit) {
                // FALLBACK: Try to resolve legacy unit string
                const resolved = await resolveSchoolId(ctx, userUnit);
                if (resolved) targetSchoolId = resolved;
                else {
                     // If we can't map operator to a school ID, we can't paginate effectively restricted data
                     return { page: [], isDone: true, continueCursor: "" };
                }
            } else {
                 return { page: [], isDone: true, continueCursor: "" };
            }
        } 
        // If not super and not operator, maybe viewer? 
        // For now, if no role, return empty?
        if (!userRole) return { page: [], isDone: true, continueCursor: "" };
    }

    // 3. Construct Query based on Indexes
    const q = ctx.db.query("skDocuments");

    // Case S: SEARCH (Priority if search term exists)
    if (args.search) {
        // Search Logic
        let searchQ = q.withSearchIndex("search_sk", q => q.search("nama", args.search!));

        // Apply filters to Search (Note: Search indexes support limited filtering fields defined in schema)
        if (targetSchoolId) {
             searchQ = searchQ.filter(q => q.eq(q.field("schoolId"), targetSchoolId));
        }
        
        if (args.status && args.status !== "all") {
             searchQ = searchQ.filter(q => q.eq(q.field("status"), args.status));
        }

        return await searchQ.paginate(args.paginationOpts);
    }

    // Case A: Filter by School (Operator default, or Admin filter)
    if (targetSchoolId) {
        if (args.status && args.status !== "all") {
             // Index: by_school_status
             return await q.withIndex("by_school_status", q => 
                q.eq("schoolId", targetSchoolId!).eq("status", args.status!)
             ).order("desc").paginate(args.paginationOpts);
        } 
        else if (args.jenisSk && args.jenisSk !== "all") {
             // Index: by_school_jenis
             return await q.withIndex("by_school_jenis", q => 
                q.eq("schoolId", targetSchoolId!).eq("jenisSk", args.jenisSk!)
             ).order("desc").paginate(args.paginationOpts);
        } 
        else {
             // Index: by_schoolId
             return await q.withIndex("by_schoolId", q => q.eq("schoolId", targetSchoolId!))
               .order("desc").paginate(args.paginationOpts);
        }
    }

    // Case B: Global View (Super Admin only)
    if (args.status && args.status !== "all") {
        return await q.withIndex("by_status", q => q.eq("status", args.status!))
            .order("desc").paginate(args.paginationOpts);
    }

    if (args.jenisSk && args.jenisSk !== "all") {
        return await q.withIndex("by_jenis", q => q.eq("jenisSk", args.jenisSk!))
            .order("desc").paginate(args.paginationOpts);
    }
    
    // Default: All recent
    return await q.order("desc").paginate(args.paginationOpts);
  },
});

// Get single SK by ID
export const get = query({
  args: { id: v.string() }, // Changed from v.id to allow debugging invalid IDs
  handler: async (ctx, args) => {
    try {
      // Manual ID validation/casting
      let skId: Id<"skDocuments">;
      try {
        skId = args.id as Id<"skDocuments">;
        // Optionally validate format here if needed, but casting is usually enough for type safety
        // Real validation happens when we try to use it with ctx.db.get
      } catch (e) {
         throw new Error("Invalid ID format");
      }

      const sk = await ctx.db.get(skId);
      if (!sk) return null;

      let teacher = null;
      if (sk.teacherId) {
        try {
          teacher = await ctx.db.get(sk.teacherId);
        } catch (err) {
          console.error(`Error fetching teacher ${sk.teacherId} for SK ${sk._id}:`, err);
        }
      }

      // Safe return with fallbacks to prevent frontend crashes
      return { 
          ...sk, 
          // Ensure critical fields exist
          createdAt: sk.createdAt || Date.now(), 
          teacherId: sk.teacherId || null,
          teacher: teacher || null,
      };
    } catch (e: any) {
      console.error(`Error in sk:get for id ${args.id}:`, e);
      // Return null or throw a clean error depending on desired behavior
      // For now, throwing a clean error is better than "Server Error"
      throw new Error(`Gagal mengambil data SK: ${e.message}`);
    }
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

// Helper to resolve schoolId from unitKerja string
async function resolveSchoolId(ctx: any, unitKerja?: string) {
    if (!unitKerja) return undefined;
    
    // 1. Try exact match by name
    const school = await ctx.db
        .query("schools")
        .filter((q: any) => q.eq(q.field("nama"), unitKerja))
        .first();
        
    if (school) return school._id;

    // 2. Try match by NSM (if unitKerja is NSM)
    if (/^\d+$/.test(unitKerja)) {
         const byNsm = await ctx.db
            .query("schools")
            .withIndex("by_nsm", (q: any) => q.eq("nsm", unitKerja))
            .first();
         if (byNsm) return byNsm._id;
    }
    
    return undefined;
}

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
    suratPermohonanUrl: v.optional(v.string()), // NEW field
    qrCode: v.optional(v.string()),
    createdBy: v.optional(v.string()), // 🔥 CHANGED to optional string (fix for bulk upload)
    token: v.optional(v.string()), // New: Support custom auth
  },
  handler: async (ctx, args) => {
    try {
      const now = Date.now();
      
      // RBAC / AUTH CHECK
      // Note: We don't have a strict `validateWriteAccess` for SK yet, but we should at least validate the token if present
      // or check identity.
      let user = null;
      if (args.token) {
          try {
              user = await validateSession(ctx, args.token);
          } catch(e) { console.error("Session invalid", e); }
      } 
      if (!user) {
          const identity = await ctx.auth.getUserIdentity();
          // If no identity and no token, we might allow it if it's open (dangerous) or fail.
          // For now, let's log warns but NOT BLOCK to avoid breaking existing flow if auth is flaky,
          // UNLESS user strictly needs it.
          // "Input Satuan Gagal" suggests it might be crashing or permissions.
          // Use the `validateSession` result to set `createdBy` if missing?
      }

      // Check if nomor SK already exists
      const existing = await ctx.db
        .query("skDocuments")
        .withIndex("by_nomor", (q) => q.eq("nomorSk", args.nomorSk))
        .first();
      
      // Auto-resolve schoolId
      const schoolId = await resolveSchoolId(ctx, args.unitKerja);

      if (existing) {
        console.log(`Duplicate Nomor SK: ${args.nomorSk}, Updating existing record...`);
        // UPSERT LOGIC: Update existing instead of throwing
        await ctx.db.patch(existing._id, {
            ...args,
            schoolId, // Update schoolId
            updatedAt: now,
            // Keep original createdAt and createdBy if not provided?
            // Overwriting is safer for "regeneration" context
        });
        return existing._id;
      }
      
      const newId = await ctx.db.insert("skDocuments", {
        ...args,
        schoolId, // Insert schoolId
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
    
    // Batch resolve school IDs optimization? 
    // For now, resolve per-doc is safer as unitKerja might vary. 
    // Optimization: Cache results in a Map
    const schoolCache = new Map<string, any>(); // Id<"schools">

    try {
      for (const doc of args.documents) {
        try {
          // Resolve School ID
          let schoolId = undefined;
          if (doc.unitKerja) {
              if (schoolCache.has(doc.unitKerja)) {
                  schoolId = schoolCache.get(doc.unitKerja);
              } else {
                  schoolId = await resolveSchoolId(ctx, doc.unitKerja);
                  if (schoolId) schoolCache.set(doc.unitKerja, schoolId);
              }
          }

          // Check duplicates
          const existing = await ctx.db
            .query("skDocuments")
            .withIndex("by_nomor", (q) => q.eq("nomorSk", doc.nomorSk))
            .first();
          
          if (!existing) {
            const id = await ctx.db.insert("skDocuments", {
              ...doc,
              schoolId, // Insert matched ID
              status: doc.status || "active",
              createdBy: args.createdBy,
              createdAt: now,
              updatedAt: now,
            });
            results.push(id);
          } else {
            console.log(`Skipping duplicate SK: ${doc.nomorSk}`);
            // Optional: Update with schoolId if missing?
            if (!existing.schoolId && schoolId) {
                 await ctx.db.patch(existing._id, { schoolId });
            }
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

import { validateSession } from "./auth_helpers";

// ... existing imports ...

// Get teachers (The Quee for SK Generation)
export const getTeachersWithSk = query({
  args: {
    isVerified: v.optional(v.boolean()),
    userRole: v.optional(v.string()), 
    userUnit: v.optional(v.string()),
    token: v.optional(v.string()), // New: Support custom auth
  },
  handler: async (ctx, args) => {

    let user = null;

    // 1. Try Token Auth (Priority)
    if (args.token) {
        try {
            user = await validateSession(ctx, args.token);
        } catch (e: any) {
            // Token invalid or expired
        }
    } 
    
    // 2. Fallback to Standard Convex Auth
    if (!user) {
        const identity = await ctx.auth.getUserIdentity();
        if (identity) {
            // Fetch user with Smart Selection
            const users = await ctx.db
                .query("users")
                .withIndex("by_email", (q) => q.eq("email", identity.email!))
                .collect();

            user = users.find(u => {
                const r = (u.role || "").toLowerCase();
                return r.includes("super") || r.includes("admin_yayasan");
            }) || users[0];
        }
    }

    if (!user) {
        return [];
    }
    
    // RBAC Logic
    const role = (user.role || "").toLowerCase();
    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    const isSuper = superRoles.some(r => role.includes(r));

    const { isVerified, userRole: argsUserRole, userUnit: argsUserUnit } = args;

    // FETCH ALL TEACHERS (Direct Scan - safest)
    let teachers = await ctx.db
      .query("teachers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // FILTER: Only those who haven't had SK generated yet
    teachers = teachers.filter(t => t.isSkGenerated !== true);
    console.log(`Ready for SK (Not Generated): ${teachers.length}`);

    // RBAC FILTERING
    if (!isSuper) {
        if (user.role === "operator") {
             if (user.schoolId) {
                 // Robust Filter: Match ID OR Match Name (Case-insensitive)
                 teachers = teachers.filter(t => {
                     const idMatch = t.schoolId === user.schoolId;
                     const unitMatch = t.unitKerja && user.unit && 
                                       t.unitKerja.trim().toLowerCase() === user.unit.trim().toLowerCase();
                     return idMatch || unitMatch;
                 });
                 console.log(`Filtered by Operator SchoolID/Unit (${user.schoolId} / ${user.unit}): ${teachers.length}`);
             } else if (user.unit) {
                 teachers = teachers.filter(t => 
                    t.unitKerja && t.unitKerja.trim().toLowerCase() === user.unit!.trim().toLowerCase()
                 );
                 console.log(`Filtered by Operator Unit (${user.unit}): ${teachers.length}`);
             } else {
                 console.log("Operator has no SchoolID or Unit");
                 return [];
             }
        } else {
             console.log(`Role ${user.role} not authorized`);
             return [];
        }
    } else {
        console.log("Super Admin - Skip RBAC");
    }

    // Apply Verification Filter if requested
    if (args.isVerified === true) {
        if (isSuper) {
             console.log("SUPER ADMIN: Bypassing Verified Filter");
        } else {
             teachers = teachers.filter(t => t.isVerified === true);
             console.log(`Filtered Verified ONLY: ${teachers.length}`);
        }
    } else if (args.isVerified === false) {
        teachers = teachers.filter(t => t.isVerified === false);
        console.log(`Filtered Unverified ONLY: ${teachers.length}`);
    }

    // Sort by UpdatedAt (Recent First) for better UX
    teachers.sort((a, b) => (b.updatedAt || b._creationTime) - (a.updatedAt || a._creationTime));

    if (isSuper && teachers.length === 0) {
        console.warn("SUPER ADMIN RETURN 0 DATA", { 
            args, 
            total: teachers.length
        });
    }

    return teachers;
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

export const debugListAllSk = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("skDocuments").collect(); // Unfiltered
  },
});

export const getLastSkNumber = query({
  args: {},
  handler: async (ctx) => {
    // Get the most recently created SK
    const lastSk = await ctx.db.query("skDocuments")
      .order("desc") // Order by _creationTime by default
      .first();
      
    return lastSk?.nomorSk || null;
  },
});

export const debugInsertSk = mutation({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.db.insert("skDocuments", {
        nomorSk: "DEBUG-SK-" + Date.now(),
        jenisSk: "debug",
        nama: "Debug SK",
        tanggalPenetapan: new Date().toISOString(),
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now()
    });
    return id;
  }
});

// FORCE RESET TOOL
export const forceResetSkFlags = mutation({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    let count = 0;
    for (const t of teachers) {
        await ctx.db.patch(t._id, { 
            isSkGenerated: false,
            isActive: true, // Ensure active logic
            isVerified: true // Ensure verification logic
        });
        count++;
    }
    return `Reset complete. Updated ${count} teachers.`;
  }
});

// SAFETY DEBUG QUERY
export const diagnoseSA = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    const active = teachers.filter(t => t.isActive === true);
    const ungenerated = active.filter(t => t.isSkGenerated !== true);
    
    // Check RBAC Logic
    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    
    // Find the calling user (or any admin as proxy)
    // For diagnosis, we look for the user with 'super_admin' role
    const adminUser = (await ctx.db.query("users").collect()).find(u => u.role && u.role.toLowerCase().includes("super"));

    if (!adminUser) return "NO SUPER ADMIN FOUND";

    const isSuper = superRoles.some(r => r.toLowerCase() === (adminUser.role || "").toLowerCase()) || (adminUser.role || "").toLowerCase().includes("admin");

    return {
        NAME: adminUser.name,
        ROLE_RAW: `"${adminUser.role}"`,
        IS_SUPER_CALC: isSuper,
        SHOULD_PASS: isSuper
    };
  }
});
