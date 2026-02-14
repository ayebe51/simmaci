import { query } from "./_generated/server";
import { v } from "convex/values";

// Simulates getTeachersWithSk logic and logs WHY a specific NUPTK is hidden
export const checkParams = query({
  args: {
    targetNuptk: v.optional(v.string()) // Optional: Check specific teacher
  },
  handler: async (ctx, args) => {
    const logs = [];
    
    // 1. Authenticate
    const identity = await ctx.auth.getUserIdentity();
    logs.push(`Identity: ${identity?.email ?? "Not Logged In"}`);
    
    if (!identity) return { logs, result: "No Identity" };

    const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
    
    logs.push(`User Role: ${user?.role}, Unit: ${user?.unit}, SchoolId: ${user?.schoolId}`);
    
    if (!user) return { logs, result: "User Found in DB: FALSE" };

    const superRoles = ["super_admin", "admin_yayasan", "admin"];
    const isSuper = superRoles.includes(user.role);
    logs.push(`Is Super Admin: ${isSuper}`);

    // 2. Fetch Active Teachers
    let teachers = await ctx.db
      .query("teachers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    logs.push(`Total Active Teachers in DB: ${teachers.length}`);

    // 3. Filter by isSkGenerated
    const notGenerated = teachers.filter(t => t.isSkGenerated !== true);
    logs.push(`Teachers with isSkGenerated !== true: ${notGenerated.length}`);
    
    // Check specific target if provided
    if (args.targetNuptk) {
        const target = teachers.find(t => t.nuptk === args.targetNuptk);
        if (target) {
            logs.push(`Target (${args.targetNuptk}) Found. isSkGenerated: ${target.isSkGenerated}, isActive: ${target.isActive}`);
        } else {
            logs.push(`Target (${args.targetNuptk}) NOT FOUND in Active list.`);
             // Check if it exists at all
             const dead = await ctx.db.query("teachers").withIndex("by_nuptk", q=>q.eq("nuptk", args.targetNuptk!)).first();
             logs.push(`Target exists in DB? ${!!dead} (Active: ${dead?.isActive})`);
        }
    }

    // 4. RBAC Filtering
    let visible = notGenerated;
    if (!isSuper) {
        if (user.role === "operator") {
             if (user.schoolId) {
                 visible = visible.filter(t => t.schoolId === user.schoolId);
                 logs.push(`Filtered by SchoolId (${user.schoolId}): ${visible.length} remain`);
             } else if (user.unit) {
                 visible = visible.filter(t => t.unitKerja === user.unit);
                 logs.push(`Filtered by Unit (${user.unit}): ${visible.length} remain`);
             } else {
                 logs.push(`Operator has NO Unit/SchoolId. Visible: 0`);
                 visible = [];
             }
        } else {
             logs.push(`User role '${user.role}' not allowed. Visible: 0`);
             visible = [];
        }
    } else {
        logs.push(`Super Admin sees all.`);
    }

    return {
        logs,
        final_count: visible.length,
        sample: visible.slice(0, 3).map(t => ({ nama: t.nama, unit: t.unitKerja, schoolId: t.schoolId }))
    };
  },
});
