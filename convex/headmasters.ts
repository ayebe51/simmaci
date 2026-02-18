import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { validateSession } from "./auth_helpers";

// Get all headmaster tenures with optional filters + enriched with teacher & school data
// Get all headmaster tenures with server-side pagination + enrichment
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    schoolId: v.optional(v.id("schools")),
    teacherId: v.optional(v.id("teachers")),
    status: v.optional(v.string()),
    schoolName: v.optional(v.string()), // Optional search
  },
  handler: async (ctx, args) => {
    const q = ctx.db.query("headmasterTenures");
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let queryWithFilters: any = q;

    // Apply filters via Index or .filter()
    if (args.schoolId) {
        queryWithFilters = q.withIndex("by_school", q => q.eq("schoolId", args.schoolId!));
    } else if (args.teacherId) {
        queryWithFilters = q.withIndex("by_teacher", q => q.eq("teacherId", args.teacherId!));
    } else if (args.status && args.status !== "all") {
        queryWithFilters = q.withIndex("by_status", q => q.eq("status", args.status!));
    } else {
        queryWithFilters = q.order("desc"); // Default order
    }

    // Apply additional filters if not covered by Index
    // Note: If we used an index above, we can still chain .filter() for other fields
    // but we can't easily chain multiple indexes.
    
    if (args.status && args.status !== "all" && !args.status) {
        // Covered by index above
    } else if (args.status && args.status !== "all") {
         // If we used schoolId or teacherId index, we need to filter status manually
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         queryWithFilters = queryWithFilters.filter((q: any) => q.eq(q.field("status"), args.status));
    }
    
    // Fuzzy search simulation (Scan)
    if (args.schoolName && args.schoolName.trim()) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         // Note: Convex doesn't support 'contains' in filter cleanly without full text search index.
         // We'll skip this server-side filter for now to avoid complexity or strictly match.
         // Or we rely on client passing ID.
    }

    // PAGINATE FIRST
    const result = await queryWithFilters.paginate(args.paginationOpts);

    // 🔥 ENRICH: Join with teacher and school data ONLY for this page
    const enrichedPage = await Promise.all(
      result.page.map(async (tenure) => {
        const teacher = await ctx.db.get(tenure.teacherId);
        const school = await ctx.db.get(tenure.schoolId);
        
        return {
          ...tenure,
          id: tenure._id,  // Add 'id' alias for compatibility
          tmt: tenure.startDate,  // Add 'tmt' alias
          teacher: teacher ? {
            _id: teacher._id,
            nama: teacher.nama,
            nip: teacher.nip,
            nuptk: teacher.nuptk,
            pendidikanTerakhir: teacher.pendidikanTerakhir,
            birthPlace: teacher.tempatLahir,  // Map to legacy field
            birthDate: teacher.tanggalLahir,   // Map to legacy field
            address: teacher.unitKerja,  // Fallback
            jabatan: "Kepala Madrasah",
            statusKepegawaian: teacher.status,
            suratPermohonanUrl: teacher.suratPermohonanUrl,
            // 🔥 TMT FALLBACK: If teacher.tmt is missing, use tenure.startDate
            tmt: teacher.tmt || tenure.startDate || "-", 
          } : null,
          school: school ? {
            _id: school._id,
            nama: school.nama,
            district: school.kecamatan
          } : null
        };
      })
    );
    
    return {
        ...result,
        page: enrichedPage
    };
  },
});

// Get single tenure by ID
export const get = query({
  args: { id: v.id("headmasterTenures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create new headmaster tenure
export const create = mutation({
  args: {
    teacherId: v.id("teachers"),
    teacherName: v.string(),
    schoolId: v.id("schools"),
    schoolName: v.string(),
    periode: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.optional(v.string()),
    skUrl: v.optional(v.string()),
    createdBy: v.optional(v.id("users")), // Made optional, derived from token
    token: v.optional(v.string()), // Auth Token
  },
  handler: async (ctx, args) => {
    try {
        // 1. AUTH & RBAC
        let user = null;
        if (args.token) {
            user = await validateSession(ctx, args.token);
        } else {
            const identity = await ctx.auth.getUserIdentity();
            if (identity?.email) {
                 user = await ctx.db
                    .query("users")
                    .withIndex("by_email", (q) => q.eq("email", identity.email!))
                    .first();
            }
        }

        if (!user) {
            throw new ConvexError("Unauthorized: Harap login terlebih dahulu.");
        }

        // 2. Operator Logic: Must match Unit Kerja
        if (user.role === 'operator') {
            if (!user.unit) {
                throw new ConvexError("Forbidden: Akun operator tidak memiliki Unit Kerja.");
            }
            
            // Normalize comparison
            const targetUnit = args.schoolName.trim().toLowerCase();
            const userUnit = user.unit.trim().toLowerCase();
            
            // Simple check
            if (!targetUnit.includes(userUnit) && !userUnit.includes(targetUnit)) {
                 throw new ConvexError(`Forbidden: Anda tidak berhak mengajukan untuk madrasah '${args.schoolName}'.`);
            }
        }

        const now = Date.now();
        
        // 3. Clean Payload (remove token and potentially undefined createdBy from args)
        const { token, createdBy, ...payload } = args;

        return await ctx.db.insert("headmasterTenures", {
          ...payload,
          status: args.status || "pending",
          createdBy: user._id, // Enforce creator
          createdAt: now,
          updatedAt: now,
        });
    } catch (err: any) {
        console.error("Headmaster Create Error:", err);
        // If it's already a ConvexError, rethrow it
        if (err.data) throw err;
        // Otherwise, wrap it
        throw new ConvexError(err.message || "Terjadi kesalahan internal server.");
    }
  },
});

// Update headmaster tenure
export const update = mutation({
  args: {
    id: v.id("headmasterTenures"),
    teacherId: v.optional(v.id("teachers")),
    teacherName: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
    schoolName: v.optional(v.string()),
    periode: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.string()),
    skUrl: v.optional(v.string()),
    nomorSk: v.optional(v.string()), // Added nomorSk
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

// Approve headmaster tenure
export const approve = mutation({
  args: {
    id: v.id("headmasterTenures"),
    approvedBy: v.id("users"),
    skUrl: v.optional(v.string()),
    nomorSk: v.optional(v.string()), // Added nomorSk
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get tenure data before updating
    const tenure = await ctx.db.get(args.id);
    if (!tenure) {
      throw new Error("Headmaster tenure not found");
    }
    
    const patchData: any = {
      status: "approved",
      approvedBy: args.approvedBy,
      approvedAt: now,
      skUrl: args.skUrl,
      updatedAt: now,
    };

    if (args.nomorSk) {
        patchData.nomorSk = args.nomorSk;
    }
    
    await ctx.db.patch(args.id, patchData);
    
    // 📝 Log approval history
    try {
      await ctx.db.insert("approvalHistory", {
        documentId: args.id,
        documentType: "headmaster",
        action: "approve",
        fromStatus: tenure.status,
        toStatus: "approved",
        performedBy: args.approvedBy,
        performedAt: now,
        comment: undefined,
      });
    } catch (error) {
      console.error("Failed to log approval history:", error);
    }
    
    // 🔔 Notification: Notify the creator that their submission was approved
    if (tenure.createdBy) {
      try {
        await ctx.db.insert("notifications", {
          userId: tenure.createdBy,
          type: "sk_approved",
          title: "Pengangkatan Kepala Disetujui",
          message: `Pengangkatan ${tenure.teacherName} sebagai Kepala ${tenure.schoolName} telah disetujui`,
          isRead: false,
          metadata: {},
          createdAt: now,
        });
      } catch (error) {
        console.error("Failed to create notification:", error);
      }
    }
    
    return args.id;
  },
});

// Reject headmaster tenure
export const reject = mutation({
  args: {
    id: v.id("headmasterTenures"),
    rejectedBy: v.id("users"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get tenure data before updating
    const tenure = await ctx.db.get(args.id);
    if (!tenure) {
      throw new Error("Headmaster tenure not found");
    }
    
    await ctx.db.patch(args.id, {
      status: "rejected",  
      updatedAt: now,
    });
    
    // 📝 Log approval history
    try {
      await ctx.db.insert("approvalHistory", {
        documentId: args.id,
        documentType: "headmaster",
        action: "reject",
        fromStatus: tenure.status,
        toStatus: "rejected",
        performedBy: args.rejectedBy,
        performedAt: now,
        comment: args.rejectionReason,
        metadata: args.rejectionReason ? {
          rejectionReason: args.rejectionReason,
        } : undefined,
      });
    } catch (error) {
      console.error("Failed to log approval history:", error);
    }
    
    // 🔔 Notification: Notify the creator that their submission was rejected
    if (tenure.createdBy) {
      try {
        let message = `Pengangkatan ${tenure.teacherName} sebagai Kepala ${tenure.schoolName} ditolak`;
        if (args.rejectionReason) {
          message += `: ${args.rejectionReason}`;
        }
        
        await ctx.db.insert("notifications", {
          userId: tenure.createdBy,
          type: "sk_rejected",
          title: "Pengangkatan Kepala Ditolak",
          message,
          isRead: false,
          metadata: {
            rejectionReason: args.rejectionReason,
          },
          createdAt: now,
        });
      } catch (error) {
        console.error("Failed to create notification:", error);
      }
    }
    
    return args.id;
  },
});

// Get active headmaster for a school
export const getActiveBySchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const tenures = await ctx.db
      .query("headmasterTenures")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    
    // Find the currently active tenure
    return tenures.find(t => t.status === "active");
  },
});

// Get count by status
export const countByStatus = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tenures = await ctx.db.query("headmasterTenures").collect();
    
    if (args.status) {
      tenures = tenures.filter(t => t.status === args.status);
    }
    
    return tenures.length;
  },
});
