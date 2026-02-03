import { QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Generate a random token
function generateToken(): string {
  // Simple random token for now. In Node env we could use crypto.
  // Using Math.random + Date is 'okay' for low-risk, but UUID is better.
  // Convex runtime supports crypto.randomUUID
  return crypto.randomUUID();
}

/**
 * Creates a new session for the user
 */
export async function createSession(
  ctx: MutationCtx, 
  userId: Id<"users">, 
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const token = generateToken();
  const now = Date.now();
  // Expires in 30 days
  const expiresAt = now + (30 * 24 * 60 * 60 * 1000); 

  await ctx.db.insert("sessions", {
    token,
    userId,
    expiresAt,
    userAgent,
    ipAddress,
    createdAt: now,
  });

  return token;
}

/**
 * Validates a session token and returns the user object.
 * Throws error if invalid or expired.
 */
export async function validateSession(ctx: QueryCtx | MutationCtx, token: string) {
  if (!token) {
    return null; // Don't throw, just return null so caller can decide
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    // Ideally we should delete it, but this is a read check.
    // Cleanup can be a background job.
    return null;
  }

  const user = await ctx.db.get(session.userId);
  return user;
}

/**
 * Same as validateSession but throws Error if failed.
 * Useful for mutations/queries that MUST be authenticated.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx, token: string) {
  const user = await validateSession(ctx, token);
  if (!user) {
    throw new Error("Unauthorized: Invalid Session");
  }
  return user;
}

/**
 * Validates password strength
 * Policy: 8 chars, 1 uppercase, 1 number, 1 symbol
 */
export function validatePassword(password: string) {
  if (password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error("Password harus mengandung minimal 1 huruf besar.");
  }
  if (!/\d/.test(password)) {
    throw new Error("Password harus mengandung minimal 1 angka.");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    throw new Error("Password harus mengandung minimal 1 simbol unik.");
  }
}
