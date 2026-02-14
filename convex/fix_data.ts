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
