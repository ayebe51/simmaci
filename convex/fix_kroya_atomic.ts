
import { mutation } from "./_generated/server";

const KROYA_TEACHER_IDS = [
  "jh7427xbf84cmkfhkjzygp2mpn814zfe",
  "jh7bqb6wxw6p05ps3zrqydctjx815hsf",
  "jh7bgp2604czff5va2dxnkr0n9814r37",
  "jh7b0hsv7d2pypegv5y0vxk741814vds",
  "jh7cq6r1gv35jrvw15560vy1d5814ysp",
  "jh7fbgsbas02xxy1pxjt1m12858154nw",
  "jh7bgpm8kxdhk2k70p0zbsrxgh815sev",
  "jh76grttr4n7w0y8b9160rzh7181498f",
  "jh73nsy9eqbtpj550edxzv7ghn815y7w",
  "jh7csy5g0jxbnrbksgm53mrn59815psy",
  "jh7e4k9n1bscyrdhxecqxxzpds815rg3",
  "jh73y54w9jee5v814bdd2g5knh814nrn",
  "jh71pgpyb5c0dexb9zh640gtxh814dtt",
  "jh737gmnr1e10278tx9v1neswn814nwd",
  "jh7f19k6qxpz4x6pne7w3mft6n8158sw",
  "jh7bnv28dtjfemzaqrtycy7rh5814jn1",
  "jh7f4ecab0s61251pddmy93b85814ea6",
  "jh75psp4whzf2r3adc64khqcbn815d82"
];

const KROYA_NSM = "121233010029"; 

export const runKroyaFix = mutation({
  args: {},
  handler: async (ctx) => {
    // Force ANY to bypass all type checks
    const db = ctx.db as any;
    const logs: string[] = [];

    try {
        // Query by NSM safely
        const schools = await db.query("schools").collect();
        const school = schools.find((s: any) => s.nsm === KROYA_NSM);
        
        if (!school) {
            logs.push(`School with NSM '${KROYA_NSM}' not found.`);
        } else {
            logs.push(`Found School: ${school.nama} (${school._id})`);
            
            for (const id of KROYA_TEACHER_IDS) {
                try {
                    const t = await db.get(id);
                    if (t) {
                        await db.patch(id, { schoolId: school._id });
                        logs.push(`FIXED: ${t.nama}`);
                    } else {
                        logs.push(`MISSING Teacher: ${id}`);
                    }
                } catch (inner: any) {
                    logs.push(`ERROR on ${id}: ${inner.message}`);
                }
            }
        }
    } catch (e: any) {
        logs.push(`FATAL: ${e.message}`);
    }

    return logs;
  },
});
