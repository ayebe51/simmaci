
import { mutation } from "./_generated/server";

const CIMANGGU_FIX = {
    userEmail: "bizrie@gmail.com",
    officialNsm: "121233010040", // MTsS Ma'arif NU Cimanggu
    duplicateNsm: "TEMP-1770973444563-135", // MTs Ma'arif NU Cimanggu (TEMP)
    officialSchoolName: "MTsS Ma'arif NU Cimanggu"
};

export const runFix = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting Data Integrity Fix (NSM Mode)...");
    const logs: string[] = [];
    const db = ctx.db as any;

    const allSchools = await db.query("schools").collect();

    const officialSchool = allSchools.find((s: any) => s.nsm === CIMANGGU_FIX.officialNsm);
    // Find duplicate by NSM
    let duplicateSchool = allSchools.find((s: any) => s.nsm === CIMANGGU_FIX.duplicateNsm);
    
    // If exact duplicate NSM not found, try finding by name and "TEMP" NSM pattern as fallback
    if (!duplicateSchool) {
         duplicateSchool = allSchools.find((s: any) => 
            s.nama === "MTs Ma'arif NU Cimanggu" && 
            s.nsm.startsWith("TEMP")
         );
    }

    // --- PART A: CIMANGGU FIX ---
    logs.push("--- PART A: CIMANGGU FIX ---");
    
    if (!officialSchool) {
        logs.push(`CRITICAL: Official school NSM ${CIMANGGU_FIX.officialNsm} NOT FOUND.`);
    } else {
        logs.push(`Found official school: ${officialSchool.nama} (${officialSchool._id})`);

        // 1. Fix User
        const user = await db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", CIMANGGU_FIX.userEmail))
            .first();

        if (user) {
             await db.patch(user._id, {
                unit: CIMANGGU_FIX.officialSchoolName,
                schoolId: officialSchool._id,
                updatedAt: Date.now()
            });
            logs.push(`Updated user ${user.email} to school ${officialSchool.nama}`);
        } else {
            logs.push(`User ${CIMANGGU_FIX.userEmail} not found.`);
        }

        // 2. Migrate Duplicate Data
        if (duplicateSchool) {
             logs.push(`Found duplicate school: ${duplicateSchool.nama} (${duplicateSchool._id})`);
             
             // Teachers
             const teachers = await db.query("teachers").collect();
             const teacherVictims = teachers.filter((t: any) => 
                t.schoolId === duplicateSchool._id || 
                t.unitKerja === duplicateSchool.nama
             );
    
             for (const t of teacherVictims) {
                await db.patch(t._id, {
                    schoolId: officialSchool._id,
                    unitKerja: officialSchool.nama,
                    updatedAt: Date.now()
                });
                logs.push(`Migrated teacher ${t.nama}`);
             }

             // SKs
             const sks = await db.query("skDocuments").collect();
             const skVictims = sks.filter((sk: any) => 
                sk.schoolId === duplicateSchool._id ||
                sk.unitKerja === duplicateSchool.nama
             );
             for (const sk of skVictims) {
                await db.patch(sk._id, {
                    schoolId: officialSchool._id,
                    unitKerja: officialSchool.nama,
                    updatedAt: Date.now()
                });
                logs.push(`Migrated SK ${sk.nomorSk}`);
             }

             // Delete Duplicate
             await db.delete(duplicateSchool._id);
             logs.push(`Deleted duplicate school: ${duplicateSchool.nama}`);
        } else {
            logs.push(`Duplicate school not found (already deleted?).`);
        }
    }

    // --- PART B: GENERAL BACKFILL ---
    logs.push("--- PART B: BACKFILL SCHOOL IDs ---");
    
    const allTeachers = await db.query("teachers").collect();
    
    // Create lookup map
    const schoolMap = new Map();
    allSchools.forEach((s: any) => {
        if (s.nama) schoolMap.set(s.nama.toLowerCase().trim(), s._id);
        if (s.nsm) schoolMap.set(s.nsm, s._id);
    });

    let fixedCount = 0;
    for (const t of allTeachers) {
        if (!t.schoolId && t.unitKerja) {
            const key = t.unitKerja.toLowerCase().trim();
            const matchId = schoolMap.get(key);
            
            if (matchId) {
                await db.patch(t._id, { schoolId: matchId });
                fixedCount++;
                if (fixedCount <= 10) logs.push(`Backfilled teacher ${t.nama}`);
            }
        }
    }
    logs.push(`Total teachers backfilled: ${fixedCount}`);
    
    return logs;
  },
});
