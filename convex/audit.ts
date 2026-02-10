
import { query } from "./_generated/server";
import { v } from "convex/values";

// Audit Rules
// 1. Duplicate NIK (if we had NIK, but we use NUPTK/NIP). 
//    Let's check Duplicate NUPTK or Names in same school.
// 2. Invalid TMT (Future date or too old).
// 3. Age Anomalies (Too young < 18, Too old > 70).
// 4. Missing Critical Data (Birthdate, Birthplace).

export const runHealthCheck = query({
  args: {},
  handler: async (ctx) => {
    const teachers = await ctx.db.query("teachers").collect();
    const issues: any[] = [];

    // Helper to calculate age
    const calculateAge = (dobString?: string) => {
        if (!dobString) return 0;
        const dob = new Date(dobString);
        if (isNaN(dob.getTime())) return 0;
        const diff = Date.now() - dob.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    // Helper map for duplicates
    const nuptkMap = new Map<string, string[]>();

    for (const t of teachers) {
        // Skip completely inactive/deleted if necessary, but "sampah" might be inactive ones too.
        // Let's check ALL.

        // 1. Critical Missing Data
        if (!t.tempatLahir || !t.tanggalLahir) {
            issues.push({
                id: t._id,
                name: t.nama,
                school: t.unitKerja,
                type: "MISSING_BIO",
                message: "Data Lahir (Tempat/Tanggal) kosong.",
                severity: "high"
            });
        }

        // 2. Age Anomalies
        const age = calculateAge(t.tanggalLahir);
        if (t.tanggalLahir && (age < 17 || age > 75)) {
             issues.push({
                id: t._id,
                name: t.nama,
                school: t.unitKerja,
                type: "AGE_ANOMALY",
                message: `Umur tidak wajar: ${age} tahun.`,
                severity: "medium"
            });
        }

        // 3. TMT Anomalies
        if (t.tmt) {
            const tmt = new Date(t.tmt);
            if (tmt.getTime() > Date.now()) {
                issues.push({
                    id: t._id,
                    name: t.nama,
                    school: t.unitKerja,
                    type: "FUTURE_TMT",
                    message: `TMT masa depan: ${t.tmt}`,
                    severity: "medium"
                });
            }
        }

        // 4. Duplicate NUPTK Check
        if (t.nuptk && t.nuptk.length > 5 && t.nuptk !== "-") { // Ignore short/dash placeholders
             const existing = nuptkMap.get(t.nuptk);
             if (existing) {
                 existing.push(t.nama);
                 nuptkMap.set(t.nuptk, existing);
             } else {
                 nuptkMap.set(t.nuptk, [t.nama]);
             }
        }
    }

    // Process Duplicates
    nuptkMap.forEach((names, nuptk) => {
        if (names.length > 1) {
            issues.push({
                type: "DUPLICATE_NUPTK",
                message: `NUPTK ${nuptk} dipakai oleh: ${names.join(", ")}`,
                severity: "high"
            });
        }
    });

    return issues.sort((a, b) => (a.severity === 'high' ? -1 : 1));
  },
});
