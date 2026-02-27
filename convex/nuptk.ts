import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// --- RBAC HELPER ---
async function validateAccess(ctx: MutationCtx | any, requireAdmin: boolean = false) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Harap login terlebih dahulu.");

    const user = await ctx.db
        .query("users")
        .withIndex("by_idOrClerk", (q: any) => q.eq("clerkId", identity.subject))
        .first();

    if (!user) throw new ConvexError("Unauthorized: Pengguna tidak terdaftar dalam sistem.");

    if (requireAdmin && !["super_admin", "admin"].includes(user.role)) {
        throw new ConvexError("Forbidden: Akses ditolak. Hanya Admin yang dapat melakukan aksi ini.");
    }

    return user;
}

// 🔥 Helper for fetching storage URLs (Supports both Legacy Convex Storage IDs and New Google Drive URLs)
export const getDocumentUrl = query({
    args: { storageId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.storageId) return null;
        
        // If it's already a full URL (like Google Drive), return it directly
        if (args.storageId.startsWith("http")) {
            return args.storageId;
        }

        // Otherwise, assume it's a legacy Convex Storage ID
        try {
            return await ctx.storage.getUrl(args.storageId as Id<"_storage">);
        } catch (e) {
            return null;
        }
    }
});

// 🔥 Generate Upload URL (Used by Operator to upload PDF/Images)
export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

// 1. Submit NUPTK Request (Operator)
export const submitRequest = mutation({
    args: {
        teacherId: v.id("teachers"),
        schoolId: v.id("schools"),
        dokumenKtpId: v.optional(v.string()),
        dokumenIjazahId: v.optional(v.string()),
        dokumenPengangkatanId: v.optional(v.string()),
        dokumenPenugasanId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await validateAccess(ctx, false);
        
        // Ensure teacher doesn't already have a pending or approved request
        const existing = await ctx.db
            .query("nuptk_submissions")
            .withIndex("by_teacherId", q => q.eq("teacherId", args.teacherId))
            .filter(q => q.neq(q.field("status"), "Rejected")) // Allow re-submit if previously rejected
            .first();

        if (existing) {
            throw new ConvexError("Guru ini sudah memiliki pengajuan aktif atau sudah disetujui.");
        }

        const id = await ctx.db.insert("nuptk_submissions", {
            teacherId: args.teacherId,
            schoolId: args.schoolId,
            status: "Pending",
            dokumenKtpId: args.dokumenKtpId,
            dokumenIjazahId: args.dokumenIjazahId,
            dokumenPengangkatanId: args.dokumenPengangkatanId,
            dokumenPenugasanId: args.dokumenPenugasanId,
            submittedAt: Date.now()
        });
        
        return id;
    }
});

// 2. List Requests (For Admin and Operator)
export const listRequests = query({
    args: {
        schoolId: v.optional(v.id("schools")), // If provided, filters exactly by school. Used by operators.
    },
    handler: async (ctx, args) => {
        let q = ctx.db.query("nuptk_submissions").order("desc");

        if (args.schoolId) {
            q = ctx.db.query("nuptk_submissions").withIndex("by_schoolId", q => q.eq("schoolId", args.schoolId!)).order("desc");
        }

        const submissions = await q.collect();

        // Enrich with teacher and school metadata
        return await Promise.all(submissions.map(async (sub) => {
            const teacher = await ctx.db.get(sub.teacherId);
            const school = await ctx.db.get(sub.schoolId);
            return {
                ...sub,
                teacherName: teacher?.nama || "Unknown Teacher",
                teacherNuptk: teacher?.nuptk || "-",
                schoolName: school?.nama || "Unknown School",
            };
        }));
    }
});

// 3. Approve or Reject Request (Admin)
export const updateStatus = mutation({
    args: {
        id: v.id("nuptk_submissions"),
        status: v.string(), // "Approved" atau "Rejected"
        rejectionReason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await validateAccess(ctx, true); // Require Admin

        const submission = await ctx.db.get(args.id);
        if (!submission) throw new ConvexError("Pengajuan tidak ditemukan.");

        if (args.status !== "Approved" && args.status !== "Rejected") {
            throw new ConvexError("Status tidak valid.");
        }

        await ctx.db.patch(args.id, {
            status: args.status,
            rejectionReason: args.status === "Rejected" ? args.rejectionReason : undefined,
            approvedAt: Date.now(),
            approverId: user._id
        });

        // Note: As per user req, NUPTK number is from DAPODIK, 
        // This is strictly a "Surat Rekomendasi" approval pipeline.
        
        return args.id;
    }
});

// 4. Delete Request (Admin or Operator if Pending)
export const removeRequest = mutation({
    args: { id: v.id("nuptk_submissions") },
    handler: async (ctx, args) => {
        const user = await validateAccess(ctx, false);
        const submission = await ctx.db.get(args.id);
        
        if (!submission) return;

        // Operator can only delete if Pending
        if (user.role === "operator" && submission.status !== "Pending") {
             throw new ConvexError("Hanya pengajuan dengan status Pending yang dapat dihapus.");
        }

        // Clean up documents from storage
        if (submission.dokumenKtpId) await ctx.storage.delete(submission.dokumenKtpId);
        if (submission.dokumenIjazahId) await ctx.storage.delete(submission.dokumenIjazahId);
        if (submission.dokumenPengangkatanId) await ctx.storage.delete(submission.dokumenPengangkatanId);
        if (submission.dokumenPenugasanId) await ctx.storage.delete(submission.dokumenPenugasanId);

        await ctx.db.delete(args.id);
    }
});
