import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// ========================================
// APPROVAL HISTORY MUTATIONS
// ========================================

// Log approval action (generic for any document type)
export const logApprovalAction = mutation({
  args: {
    documentId: v.string(),
    documentType: v.string(),
    action: v.string(),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    performedBy: v.id("users"),
    comment: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const historyId = await ctx.db.insert("approvalHistory", {
      documentId: args.documentId,
      documentType: args.documentType,
      action: args.action,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      performedBy: args.performedBy,
      performedAt: Date.now(),
      comment: args.comment,
      metadata: args.rejectionReason ? {
        rejectionReason: args.rejectionReason,
      } : undefined,
    })

    return { success: true, historyId }
  },
})

// Add comment to document
export const addComment = mutation({
  args: {
    documentId: v.string(),
    documentType: v.string(),
    performedBy: v.id("users"),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("approvalHistory", {
      documentId: args.documentId,
      documentType: args.documentType,
      action: "comment",
      performedBy: args.performedBy,
      performedAt: Date.now(),
      comment: args.comment,
    })

    return { success: true }
  },
})

// ========================================
// APPROVAL HISTORY QUERIES
// ========================================

// Get approval history for a document
export const getApprovalHistory = query({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("approvalHistory")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect()

    // Enrich with user data
    const enriched = await Promise.all(
      history.map(async (h) => {
        const user = await ctx.db.get(h.performedBy)
        return {
          ...h,
          performedByName: user?.name || "Unknown",
          performedByEmail: user?.email || "",
          performedByRole: user?.role || "",
        }
      })
    )

    // Sort by date (newest first)
    enriched.sort((a, b) => b.performedAt - a.performedAt)

    return enriched
  },
})

// Get recent approval actions (for activity feed)
export const getRecentApprovalActions = query({
  args: {
    limit: v.optional(v.number()),
    documentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20

    let history = await ctx.db
      .query("approvalHistory")
      .withIndex("by_date")
      .order("desc")
      .take(limit * 2) // Take more to filter

    // Filter by document type if specified
    if (args.documentType) {
      history = history.filter((h) => h.documentType === args.documentType)
    }

    // Enrich with user data
    const enriched = await Promise.all(
      history.slice(0, limit).map(async (h) => {
        const user = await ctx.db.get(h.performedBy)
        return {
          ...h,
          performedByName: user?.name || "Unknown",
          performedByRole: user?.role || "",
        }
      })
    )

    return enriched
  },
})

// Get approval statistics
export const getApprovalStats = query({
  args: {
    documentType: v.optional(v.string()),
    days: v.optional(v.number()), // Last N days
  },
  handler: async (ctx, args) => {
    const days = args.days || 30
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000

    let history = await ctx.db
      .query("approvalHistory")
      .withIndex("by_date")
      .filter((q) => q.gte(q.field("performedAt"), cutoffDate))
      .collect()

    // Filter by document type if specified
    if (args.documentType) {
      history = history.filter((h) => h.documentType === args.documentType)
    }

    const stats = {
      total: history.length,
      approvals: history.filter((h) => h.action === "approve").length,
      rejections: history.filter((h) => h.action === "reject").length,
      comments: history.filter((h) => h.action === "comment").length,
      byAction: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
    }

    // Aggregate by action
    history.forEach((h) => {
      stats.byAction[h.action] = (stats.byAction[h.action] || 0) + 1
    })

    // Aggregate by user
    for (const h of history) {
      const user = await ctx.db.get(h.performedBy)
      const userName = user?.name || "Unknown"
      stats.byUser[userName] = (stats.byUser[userName] || 0) + 1
    }

    return stats
  },
})

// Get approval history for a user (what they approved/rejected)
export const getUserApprovalHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50

    const history = await ctx.db
      .query("approvalHistory")
      .withIndex("by_user", (q) => q.eq("performedBy", args.userId))
      .order("desc")
      .take(limit)

    return history
  },
})
