
import { mutation } from "./_generated/server";

export const normalizeNames = mutation({
  args: {},
  handler: async (ctx) => {
    const logs: string[] = [];
    const schools = await ctx.db.query("schools").collect();
    
    const UPPER_KEEP = new Set(["NU", "MI", "MA", "SD", "TK", "KB", "RA", "SMK", "SMA", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "DIY"]);
    const REPLACEMENTS: Record<string, string> = {
        "MTS": "MTs",
        "MTSS": "MTs",
        "MAARIF": "Ma'arif",
        "MA'ARIF": "Ma'arif"
    };

    function toTitleCase(word: string): string {
        // Strip punctuation for checking logic if needed, but here simple split is likely enough
        // Handle parentheses e.g. (TEMP)
        if (word.startsWith("(") && word.endsWith(")")) {
            return "(" + toTitleCase(word.slice(1, -1)) + ")";
        }

        const upper = word.toUpperCase();
        
        // 1. Direct Replacements
        if (REPLACEMENTS[upper]) return REPLACEMENTS[upper];

        // 2. Keep Uppercase
        if (UPPER_KEEP.has(upper)) return upper;

        // 3. Handle special "Ma'arif" if stuck together or variations
        if (upper.includes("MA'ARIF")) return "Ma'arif";

        // 4. Default Title Case
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    for (const school of schools) {
        const oldName = school.nama.trim();
        const parts = oldName.split(/\s+/);
        
        const newParts = parts.map(toTitleCase);
        
        // Ensure "Ma'arif" is correct even if split weirdly? Usually it's space separated.
        
        const newName = newParts.join(" ");

        if (newName !== oldName) {
            logs.push(`Renaming: "${oldName}" -> "${newName}"`);
            await ctx.db.patch(school._id, {
                nama: newName,
                updatedAt: Date.now()
            });

            // Cascading Updates (Best Effort)
            // 1. Users
            const users = await ctx.db.query("users").filter(q => q.eq(q.field("unit"), oldName)).collect();
            for (const u of users) {
                await ctx.db.patch(u._id, { unit: newName });
            }
            if (users.length > 0) logs.push(`  Updated ${users.length} users`);

            // 2. Teachers
            const teachers = await ctx.db.query("teachers").filter(q => q.eq(q.field("unitKerja"), oldName)).collect();
            for (const t of teachers) {
                await ctx.db.patch(t._id, { unitKerja: newName });
            }
            if (teachers.length > 0) logs.push(`  Updated ${teachers.length} teachers`);

            // 3. SK Documents
            const sks = await ctx.db.query("skDocuments").filter(q => q.eq(q.field("unitKerja"), oldName)).collect();
            for (const sk of sks) {
                await ctx.db.patch(sk._id, { unitKerja: newName });
            }
            if (sks.length > 0) logs.push(`  Updated ${sks.length} SKs`);
        }
    }

    return logs;
  },
});
