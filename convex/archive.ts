import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// ========================================
// ARCHIVE MUTATIONS
// ========================================

// Archive single SK
export const archiveSk = mutation({
  args: {
    skId: v.id("skDocuments"),
    archivedBy: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sk = await ctx.db.get(args.skId)
    if (!sk) {
      throw new Error("SK not found")
    }

    await ctx.db.patch(args.skId, {
      status: "archived",
      archivedAt: Date.now(),
      archivedBy: args.archivedBy,
      archiveReason: args.reason,
      updatedAt: Date.now(),
    })

    return { success: true, skId: args.skId }
  },
})

// Restore archived SK
export const restoreSk = mutation({
  args: {
    skId: v.id("skDocuments"),
    restoredBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sk = await ctx.db.get(args.skId)
    if (!sk) {
      throw new Error("SK not found")
    }

    if (sk.status !== "archived") {
      throw new Error("SK is not archived")
    }

    await ctx.db.patch(args.skId, {
      status: "active", // Restore to active status
      archivedAt: undefined,
      archivedBy: undefined,
      archiveReason: undefined,
      updatedAt: Date.now(),
    })

    return { success: true, skId: args.skId }
  },
})

// Bulk archive multiple SKs
export const bulkArchive = mutation({
  args: {
    skIds: v.array(v.id("skDocuments")),
    archivedBy: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    let successCount = 0
    let failCount = 0

    for (const skId of args.skIds) {
      try {
        const sk = await ctx.db.get(skId)
        if (sk && sk.status !== "archived") {
          await ctx.db.patch(skId, {
            status: "archived",
            archivedAt: now,
            archivedBy: args.archivedBy,
            archiveReason: args.reason,
            updatedAt: now,
          })
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error(`Failed to archive SK ${skId}:`, error)
        failCount++
      }
    }

    return {
      success: true,
      archived: successCount,
      failed: failCount,
      total: args.skIds.length,
    }
  },
})

// Bulk restore multiple SKs
export const bulkRestore = mutation({
  args: {
    skIds: v.array(v.id("skDocuments")),
    restoredBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    let successCount = 0
    let failCount = 0

    for (const skId of args.skIds) {
      try {
        const sk = await ctx.db.get(skId)
        if (sk && sk.status === "archived") {
          await ctx.db.patch(skId, {
            status: "active",
            archivedAt: undefined,
            archivedBy: undefined,
            archiveReason: undefined,
            updatedAt: now,
          })
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error(`Failed to restore SK ${skId}:`, error)
        failCount++
      }
    }

    return {
      success: true,
      restored: successCount,
      failed: failCount,
      total: args.skIds.length,
    }
  },
})

// Auto-archive old SKs (for cron job)
export const autoArchiveOldSks = mutation({
  args: {
    olderThanYears: v.number(), // e.g., 3
    maxToArchive: v.optional(v.number()), // Limit per run
  },
  handler: async (ctx, args) => {
    const cutoffDate = Date.now() - (args.olderThanYears * 365 * 24 * 60 * 60 * 1000)
    const limit = args.maxToArchive || 100

    const allSks = await ctx.db.query("skDocuments").collect()
    const oldSks = allSks
      .filter(sk => 
        sk.status !== "archived" &&
        sk.createdAt < cutoffDate
      )
      .slice(0, limit)

    const now = Date.now()
    for (const sk of oldSks) {
      await ctx.db.patch(sk._id, {
        status: "archived",
        archivedAt: now,
        archiveReason: `Auto-archived (older than ${args.olderThanYears} years)`,
        updatedAt: now,
      })
    }

    return {
      archived: oldSks.length,
      cutoffDate,
      olderThanYears: args.olderThanYears,
    }
  },
})

// Permanently delete archived SKs (admin only)
export const deleteArchivedSks = mutation({
  args: {
    olderThanDays: v.number(), // e.g., 90
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const admin = await ctx.db.get(args.adminId)
    if (!admin || admin.role !== "super_admin") {
      throw new Error("Only super_admin can permanently delete archived SKs")
    }

    const cutoffDate = Date.now() - (args.olderThanDays * 24 * 60 * 60 * 1000)

    const allArchived = await ctx.db
      .query("skDocuments")
      .filter(q => q.eq(q.field("status"), "archived"))
      .collect()

    const oldArchived = allArchived.filter(
      sk => sk.archivedAt && sk.archivedAt < cutoffDate
    )

    for (const sk of oldArchived) {
      await ctx.db.delete(sk._id)
    }

    return {
      deleted: oldArchived.length,
      cutoffDate,
      olderThanDays: args.olderThanDays,
    }
  },
})

// ========================================
// ARCHIVE QUERIES
// ========================================

// Get archived SKs with filters
export const getArchivedSks = query({
  args: {
    jenisSk: v.optional(v.string()),
    unitKerja: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    search: v.optional(v.string()), // Search by nomor or nama
  },
  handler: async (ctx, args) => {
    let sks = await ctx.db
      .query("skDocuments")
      .filter(q => q.eq(q.field("status"), "archived"))
      .collect()

    // Apply filters
    if (args.jenisSk && args.jenisSk !== "all") {
      sks = sks.filter(sk => sk.jenisSk === args.jenisSk)
    }

    if (args.unitKerja) {
      sks = sks.filter(sk => sk.unitKerja === args.unitKerja)
    }

    if (args.startDate) {
      sks = sks.filter(sk => sk.archivedAt && sk.archivedAt >= args.startDate!)
    }

    if (args.endDate) {
      sks = sks.filter(sk => sk.archivedAt && sk.archivedAt <= args.endDate!)
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase()
      sks = sks.filter(sk =>
        sk.nomorSk.toLowerCase().includes(searchLower) ||
        sk.nama.toLowerCase().includes(searchLower)
      )
    }

    // Sort by archived date (newest first)
    sks.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0))

    return sks
  },
})

// Get archive statistics
export const getArchiveStats = query({
  handler: async (ctx) => {
    const archived = await ctx.db
      .query("skDocuments")
      .filter(q => q.eq(q.field("status"), "archived"))
      .collect()

    const byType = {
      gty: archived.filter(s => s.jenisSk === "gty").length,
      gtt: archived.filter(s => s.jenisSk === "gtt").length,
      kamad: archived.filter(s => s.jenisSk === "kamad").length,
      tendik: archived.filter(s => s.jenisSk === "tendik").length,
    }

    const archivedDates = archived
      .filter(s => s.archivedAt)
      .map(s => s.archivedAt!)

    return {
      total: archived.length,
      byType,
      oldest: archivedDates.length > 0 ? Math.min(...archivedDates) : null,
      newest: archivedDates.length > 0 ? Math.max(...archivedDates) : null,
    }
  },
})

// Get recently archived SKs (last 10)
export const getRecentlyArchived = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10

    const archived = await ctx.db
      .query("skDocuments")
      .filter(q => q.eq(q.field("status"), "archived"))
      .collect()

    // Sort by archived date (newest first)
    archived.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0))

    return archived.slice(0, limit)
  },
})
