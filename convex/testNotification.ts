import { v } from "convex/values"
import { mutation } from "./_generated/server"

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
      throw new Error(`User with email ${args.userEmail} not found`)
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
