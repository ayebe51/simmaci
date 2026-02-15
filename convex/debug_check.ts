import { query } from "./_generated/server";
import { v } from "convex/values";

export const simple = query({
  args: {},
  handler: async (ctx) => {
    // 1. Check Auth (Is it working?)
    const identity = await ctx.auth.getUserIdentity();
    
    // 2. Raw DB Scan (No filters)
    const teachers = await ctx.db.query("teachers").take(5);
    
    // 3. Check specific teacher status
    const sample = teachers[0];
    
    return {
        identity: identity ? { name: identity.name, email: identity.email } : "NO IDENTITY",
        total_sample: teachers.length,
        first_teacher: sample ? {
            name: sample.nama,
            isActive: sample.isActive,
            isSkGenerated: sample.isSkGenerated,
            isVerified: sample.isVerified
        } : "NO DATA"
    };
  },
});

export const trace = query({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // 1. Auth & User
    // Try to find user by known partial email if auth fails
    let targetEmail = args.email ?? "alayyubi61"; 
    
    // First try exact match
    let users = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", targetEmail)).collect();
    
    // Fallback: Scan for partial match (e.g. NIP or name)
    if (users.length === 0) {
       const allUsers = await ctx.db.query("users").collect();
       // Try '111233' seen in logs, or the arg
       const candidates = allUsers.filter(u => u.email && (u.email.includes(targetEmail) || u.email.includes("111233")));
       if (candidates.length > 0) users = candidates;
    }

    // Replicate Smart Logic
    const user = users.find(u => {
        const r = (u.role || "").toLowerCase();
        return r.includes("super") || r.includes("admin_yayasan");
    }) || users[0];

    if (!user) return { step: "UserDB", error: "User not found" };

    // 2. Counts
    const all = await ctx.db.query("teachers").collect();
    const active = all.filter(t => t.isActive === true);
    const ready = active.filter(t => t.isSkGenerated !== true);
    
    // 3. RBAC Simulation
    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    const userRole = (user.role || "").toLowerCase().trim();
    const isSuper = superRoles.some(r => r === userRole) || userRole.includes("admin");

    let final = ready;
    let rbacLog = "Super Admin (Bypass)";

    if (!isSuper) {
        rbacLog = `Operator (Role: ${userRole})`;
        if (user.role === "operator") {
             if (user.schoolId) {
                 final = final.filter(t => t.schoolId === user.schoolId); // Simple check
                 rbacLog += ` -> Filter by SchoolId ${user.schoolId}`;
             } else if (user.unit) {
                 final = final.filter(t => t.unitKerja === user.unit);
                 rbacLog += ` -> Filter by Unit ${user.unit}`;
             } else {
                 final = [];
                 rbacLog += " -> No Context";
             }
        } else {
             final = [];
             rbacLog += " -> Unauthorized Role";
        }
    }

    return {
        user: { name: user.name, role: user.role, email: user.email, schoolId: user.schoolId },
        counts: {
            total: all.length,
            active: active.length,
            ready_scannable: ready.length,
            final_visible: final.length
        },
        logic: {
            isSuper,
            rbacLog,
            sample_ready_teacher: ready.length > 0 ? {
                name: ready[0].nama,
                schoolId: ready[0].schoolId,
                unit: ready[0].unitKerja
            } : "NONE"
        }
    };
  }
});
