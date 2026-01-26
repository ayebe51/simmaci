import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createTestNotificationById = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return "restored";
  },
});
