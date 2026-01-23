import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// List all users (for finding correct email)
export const listUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect()
    return users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
    }))
  },
})

// 🧪 TEST ONLY - Create sample notification for testing UI
export const createTestNotification = mutation({
  args: {
    userEmail: v.string(), // Email of user to notify
  },
  handler: async (ctx, args) => {
    // Find user by email
    const users = await ctx.db.query("users").collect()
    const targetUser = users.find(u => u.email === args.userEmail)
    
    if (!targetUser) {
      // Show available emails to help debugging
      const availableEmails = users.map(u => u.email).join(", ")
      throw new Error(`User with email ${args.userEmail} not found. Available emails: ${availableEmails}`)
    }
    
    // Create test notification
    const notificationId = await ctx.db.insert("notifications", {
      userId: targetUser._id,
      type: "sk_approved",
      title: "🧪 Test Notification",
      message: "This is a test notification to verify the notification system is working correctly. You can delete this.",
      isRead: false,
      metadata: {
        batchCount: 1,
      },
      createdAt: Date.now(),
    })
    
    return {
      success: true,
      notificationId,
      userName: targetUser.name,
      userEmail: targetUser.email,
    }
  },
})

// Simpler version using userId directly
export const createTestNotificationById = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    
    if (!user) {
      throw new Error("User not found")
    }
    
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "sk_approved",
      title: "🧪 Test Notification",
      message: `Test notification created at ${new Date().toLocaleString('id-ID')}. Notification system is working!`,
      isRead: false,
      metadata: {
        batchCount: 1,
      },
      createdAt: Date.now(),
    })
    
    return {
      success: true,
      notificationId,
      userName: user.name,
      userEmail: user.email,
    }
  },
})
