import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Doc, Id } from "./_generated/dataModel"

// Create notification mutation
export const createNotification = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    metadata: v.optional(v.object({
      skId: v.optional(v.id("skDocuments")),
      batchCount: v.optional(v.number()),
      rejectionReason: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      metadata: args.metadata,
      isRead: false,
      createdAt: Date.now(),
    })
    
    return notificationId
  },
})

// Mark notification as read
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      isRead: true,
    })
  },
})

// Mark all notifications as read for a user
export const markAllAsRead = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .collect()

    for (const notif of unreadNotifications) {
      await ctx.db.patch(notif._id, { isRead: true })
    }
    
    return { count: unreadNotifications.length }
  },
})

// Delete notification
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.notificationId)
  },
})

// Get unread count
export const getUnreadCount = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .collect()

    return unreadNotifications.length
  },
})

// Get recent notifications (last 50)
export const getRecentNotifications = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50
    
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit)

    return notifications
  },
})

// Get notification history (paginated with cursor)
export const getNotificationHistory = query({
  args: {
    userId: v.id("users"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20
    
    let query = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
    
    // TODO: Implement cursor-based pagination if needed
    const notifications = await query.take(limit)
    
    return {
      notifications,
      cursor: notifications.length > 0 
        ? notifications[notifications.length - 1]._id
        : null,
    }
  },
})

// Internal mutation for cleanup (to be used with cron)
export const cleanupOldNotifications = mutation({
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    
    const oldNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_created", (q) => q.lt("createdAt", thirtyDaysAgo))
      .filter((q) => q.eq(q.field("isRead"), true))
      .collect()

    for (const notif of oldNotifications) {
      await ctx.db.delete(notif._id)
    }
    
    return { deleted: oldNotifications.length }
  },
})
