import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 1. SMART RESET TOOL (Backfill School ID + Reset Flags)
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    const schools = await ctx.db.query("schools").collect();
    
    // Create School Map for fast lookup
    const schoolMap = new Map();
    schools.forEach(s => {
        schoolMap.set(s.nama.toLowerCase().trim(), s._id);
        if (s.nsm) schoolMap.set(s.nsm, s._id); // Also map NSM if needed
    });

    let count = 0;
    let mappedCount = 0;

    for (const t of teachers) {
        const update: any = { 
            isSkGenerated: false,
            isActive: true, 
            isVerified: true
        };

        // Attempt to backfill School ID if missing
        if (!t.schoolId && t.unitKerja) {
            const key = t.unitKerja.toLowerCase().trim();
            const matchedId = schoolMap.get(key);
            if (matchedId) {
                update.schoolId = matchedId;
                mappedCount++;
            }
        }

        await ctx.db.patch(t._id, update);
        count++;
    }
    return `SUCCESS: Reset ${count} teachers. Backfilled School ID for ${mappedCount} teachers.`;
  }
});

// 2. DEBUG TOOL (New - No Auth)
export const checkParams = query({
  args: {
    targetNuptk: v.optional(v.string()) 
  },
  handler: async (ctx, args) => {
    const logs = [];
    
    // Bypass Auth for Debugging
    const identity = await ctx.auth.getUserIdentity();
    logs.push(`Caller Identity: ${identity?.email ?? "Anonymous"}`);

    // Fetch Active Teachers
    let teachers = await ctx.db.query("teachers").filter(q => q.eq(q.field("isActive"), true)).collect();
    logs.push(`Total Active Teachers: ${teachers.length}`);

    // Filter by isSkGenerated
    const notGenerated = teachers.filter(t => t.isSkGenerated !== true);
    logs.push(`Teachers Ready for SK (isSkGenerated != true): ${notGenerated.length}`);
    
    // Sample Data
    const sample = notGenerated.slice(0, 5).map(t => ({ 
        nama: t.nama, 
        unit: t.unitKerja,
        schoolId: t.schoolId,
        isSkGenerated: t.isSkGenerated
    }));

    return {
        logs,
        final_count: notGenerated.length,
        sample
    };
  },
});

// 3. MATCHING DEBUGGER
export const debugMatching = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").take(10);
    const schools = await ctx.db.query("schools").collect();
    
    const teacherUnits = teachers.map(t => t.unitKerja);
    const schoolNames = schools.map(s => s.nama);

    return {
        step: "Comparison",
        example_teacher_units: teacherUnits,
        available_school_names: schoolNames.slice(0, 10), // Show first 10
        total_schools: schools.length,
        match_test: teacherUnits.map(unit => {
            const key = (unit || "").toLowerCase().trim();
            const match = schools.find(s => s.nama.toLowerCase().trim() === key);
            return `${unit} => ${match ? "MATCH: " + match.nama : "NO MATCH"}`;
        })
    };
  }
});

// 4. DEEP INSPECTION & FORCE FIX
export const inspectDeep = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").take(20);
    const schools = await ctx.db.query("schools").collect();
    
    // Map School Name -> School ID
    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.nama.toLowerCase().trim(), s._id));

    const analysis = teachers.map(t => {
        const key = (t.unitKerja || "").toLowerCase().trim();
        const expectedId = schoolMap.get(key);
        const actualId = t.schoolId;
        const isMatch = expectedId === actualId;
        
        return {
            name: t.nama,
            unit: t.unitKerja,
            schoolId_Current: actualId,
            schoolId_Expected: expectedId,
            schoolName_Expected: expectedId ? schools.find(s=>s._id === expectedId)?.nama : "UNKNOWN SCHOOL",
            STATUS: isMatch ? "OK" : (actualId ? "MISMATCH (Stale ID?)" : "MISSING ID"),
            isSkGenerated: t.isSkGenerated,
            isActive: t.isActive
        };
    });

    return {
        summary: "Checking if Teacher School IDs match the School Table...",
        analysis
    };
  }
});

// 5. FORCE BACKFILL (Overwrite existing IDs)
export const forceBackfill = mutation({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    const schools = await ctx.db.query("schools").collect();
    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.nama.toLowerCase().trim(), s._id));

    let fixed = 0;
    for (const t of teachers) {
        if (t.unitKerja) {
            const key = t.unitKerja.toLowerCase().trim();
            const correctId = schoolMap.get(key);
            
            // Fix if missing OR mismatch
            if (correctId && t.schoolId !== correctId) {
                await ctx.db.patch(t._id, { schoolId: correctId });
                fixed++;
            }
        }
    }
    return `Force Backfill Complete. Fixed ${fixed} teachers.`;
  }
});

// 6. RBAC DIAGNOSTIC (Why can't I see my data?)
export const checkAccess = query({
  args: {
    email: v.optional(v.string()) // Optional: Simulate specific user
  },
  handler: async (ctx, args) => {
    let user;
    
    if (args.email) {
        user = await ctx.db.query("users").withIndex("by_email", q=>q.eq("email", args.email!)).first();
        if (!user) return { error: `User with email ${args.email} not found` };
    } else {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "Not logged in. Use 'email' argument to simulate a user." };
        
        user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();
    }
    
    if (!user) return { error: "User record not found" };

    const teachers = await ctx.db.query("teachers").take(5);
    
    return {
        user: {
            name: user.name,
            role: user.role,
            schoolId: user.schoolId,
            unit: user.unit
        },
        analysis: teachers.map(t => {
            let reason = "Visible";
            let canSee = true;

            // Check SK Generated
            if (t.isSkGenerated) {
                canSee = false; 
                reason = "Hidden: SK Already Generated";
            }

            // Check RBAC
            if (user.role === "operator" && canSee) {
                if (user.schoolId) {
                    if (t.schoolId !== user.schoolId) {
                        canSee = false;
                        reason = `Hidden: School ID Mismatch (User: ${user.schoolId} vs Teacher: ${t.schoolId})`;
                    }
                } else if (user.unit) {
                    if (t.unitKerja !== user.unit) {
                        canSee = false;
                        reason = `Hidden: Unit Mismatch (User: ${user.unit} vs Teacher: ${t.unitKerja})`;
                    }
                } else {
                    canSee = false;
                    reason = "Hidden: User has no SchoolID or Unit";
                }
            }

            return {
                teacher: t.nama,
                schoolId: t.schoolId,
                unit: t.unitKerja,
                isSkGenerated: t.isSkGenerated,
                RESULT: canSee ? "VISIBLE" : reason
            };
        })
    };
  }
});

export const verifySkQuery = query({
  args: {
    role: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    const role = args.role || "super_admin";
    const allTeachers = await ctx.db.query("teachers").collect();
    
    // 1. Total
    const total = allTeachers.length;
    
    // 2. Verified Filter (if applicable, but mainly Active)
    const active = allTeachers.filter(t => t.isActive === true);
    
    // 3. Not Generated SK
    const validForSk = active.filter(t => !t.isSkGenerated);
    
    // 4. Sample
    const sample = validForSk.slice(0, 3).map(t => ({
        name: t.nama,
        schoolId: t.schoolId,
        unit: t.unitKerja,
        isSkGenerated: t.isSkGenerated
    }));

    return {
        step1_total: total,
        step2_active: active.length,
        step3_ready_for_sk: validForSk.length,
        role_simulated: role,
        sample_candidates: sample,
        // Analysis
        conclusion: validForSk.length === 0 ? "NO DATA AVAILABLE FOR GENERATION" : "DATA EXISTS - CHECK FRONTEND"
    };
  }
});

export const checkUserRoles = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const roles = [...new Set(users.map(u => u.role))];
    // Security: Only show names/roles, not emails if sensitive, but for debug we need to know who is who.
    // Filter for admins
    const admins = users.filter(u => u.role.includes("admin")).map(u => ({ name: u.name, role: u.role, email: u.email }));
    return {
        rolesFound: roles,
        totalUsers: users.length,
        admins: admins
    };
  }
});

export const debugOp = query({
  args: {}, // No args needed
  handler: async (ctx) => {
    const keyword = "cimanggu"; // HARDCODED
    // 1. Find the User/Operator
    const users = await ctx.db.query("users").collect();
    const operator = users.find(u => 
        (u.name && u.name.toLowerCase().includes(keyword.toLowerCase())) ||
        (u.unit && u.unit.toLowerCase().includes(keyword.toLowerCase()))
    );

    if (!operator) {
        return { error: `No operator found matching '${keyword}'` };
    }

    // 2. Find Teachers that MIGHT match (by string)
    const allTeachers = await ctx.db.query("teachers").collect();
    const potentialMatches = allTeachers.filter(t => 
        t.unitKerja && t.unitKerja.toLowerCase().includes(keyword.toLowerCase())
    );

    // 3. Analyze why they might be hidden
    const analysis = potentialMatches.map(t => {
        let status = "VISIBLE";
        let reason = "OK";

        // Check 1: SK Generated
        if (t.isSkGenerated) {
            status = "HIDDEN";
            reason = "Already Generated";
        }
        // Check 2: Active
        else if (t.isActive !== true) {
             status = "HIDDEN";
             reason = "Not Active";
        }
        // Check 3: RBAC (The likely culprit)
        else {
            const schoolMatch = operator.schoolId && t.schoolId === operator.schoolId;
            const unitMatch = operator.unit && t.unitKerja === operator.unit;
            
            if (!schoolMatch && !unitMatch) {
                status = "HIDDEN";
                reason = `RBAC Fail. User Unit: '${operator.unit}', Teacher Unit: '${t.unitKerja}'. User SchoolId: '${operator.schoolId}', Teacher SchoolId: '${t.schoolId}'`;
            }
        }

        return {
            name: t.nama,
            unit: t.unitKerja,
            schoolId: t.schoolId,
            status,
            reason
        };
    });

    return {
        _OPERATOR_DEBUG: {
            name: operator.name,
            unit: operator.unit,
            schoolId: operator.schoolId
        },
        _TEACHER_SAMPLE: analysis.slice(0, 1) // Just 1
    };
  }
});
