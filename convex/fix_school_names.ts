
import { mutation } from "./_generated/server";

export const normalizeNames = mutation({
  args: {},
  handler: async (ctx) => {
    // ... (Keeping original normalization logic available if needed)
    return ["Normalization logic available but skipped for this targeted run"];
  },
});

export const syncUsers = mutation({
  args: {},
  handler: async (ctx) => {
    return ["Legacy sync skipped. Use advancedSync instead."];
  }
});

export const advancedSync = mutation({
  args: {},
  handler: async (ctx) => {
    const logs: string[] = [];
    const schools = await ctx.db.query("schools").collect();
    const users = await ctx.db.query("users").collect();
    
    // 1. Build Lookup Maps
    const schoolsById = new Map<string, any>();
    const schoolsByNormalizedName = new Map<string, any>();

    // Helper: Normalize for fuzzy match (remove punctuation, lowercase, squish spaces)
    function fuzzyNorm(str: string) {
        return str.toLowerCase()
            .replace(/['"`.,()-]/g, "") // Remove punctuation
            .replace(/\s+/g, " ") // Squish spaces
            .trim();
    }

    for (const s of schools) {
        schoolsById.set(s._id, s);
        schoolsByNormalizedName.set(fuzzyNorm(s.nama), s);
        
        // Add variations for common prefixes
        const norm = fuzzyNorm(s.nama);
        if (norm.startsWith("mtss ")) {
             schoolsByNormalizedName.set(norm.replace("mtss ", "mts "), s);
        }
        if (norm.startsWith("mts ")) {
             schoolsByNormalizedName.set(norm.replace("mts ", "mtss "), s);
        }
        if (norm.startsWith("smp ")) {
            schoolsByNormalizedName.set(norm.replace("smp ", "smps "), s);
        }
    }

    logs.push(`Loaded ${schools.length} schools for sync.`);

    // 2. Iterate Users
    for (const user of users) {
        let updates: any = {};
        let updated = false;
        let school = null;

        // STRATEGY A: Trust ID if present
        if (user.schoolId) {
            school = schoolsById.get(user.schoolId);
            if (school) {
                // Check if string matches. If not, update string to match ID (Master Data wins)
                if (user.unit !== school.nama) {
                     updates.unit = school.nama;
                     updated = true;
                     logs.push(`[ID-MATCH] Updated string for ${user.name}: "${user.unit}" -> "${school.nama}"`);
                }
            } else {
                // Dead ID link? Remove it?
                // updates.schoolId = undefined; 
                // updated = true;
                logs.push(`[WARNING] User ${user.name} has invalid schoolId: ${user.schoolId}`);
            }
        } 
        
        // STRATEGY B: If no school (or dead ID), try Fuzzy Link
        if (!school && user.unit) {
            const userNorm = fuzzyNorm(user.unit);
            school = schoolsByNormalizedName.get(userNorm);

            if (school) {
                updates.schoolId = school._id;
                updates.unit = school.nama; // Enforce exact name match too
                updated = true;
                logs.push(`[FUZZY-MATCH] Linked ${user.name}: "${user.unit}" -> "${school.nama}"`);
            } else {
                logs.push(`[UNMATCHED] could not match "${user.unit}" (Norm: ${userNorm})`);
            }
        }

        if (updated) {
            await ctx.db.patch(user._id, {
                ...updates,
                updatedAt: Date.now()
            });
        }
    }

    return logs;
  }
});
