import { query } from "./_generated/server";
import { v } from "convex/values";

// Verify SK by verification code/ID
export const verifyByCode = query({
  args: { 
    code: v.string() 
  },
  handler: async (ctx, args) => {
    // Search for SK in teacherSks table by verification code or ID
    const sk = await ctx.db
      .query("teacherSks")
      .filter((q) => q.or(
        q.eq(q.field("verificationCode"), args.code),
        q.eq(q.field("_id"), args.code)
      ))
      .first();
    
    if (!sk) {
      return null;
    }
    
    // Get teacher data
    const teacher = await ctx.db.get(sk.teacherId);
    
    return {
      skNumber: sk.nomorSk,
      status: sk.status,
      teacher: teacher ? {
        nama: teacher.nama,
        nuptk: teacher.nuptk,
        nip: teacher.nip
      } : null,
      issuedDate: sk.createdAt,
      validUntil: sk.validUntil
    };
  },
});
