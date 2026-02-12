
// Helper to determine teacher status based on business rules
// 1. PNS/ASN/PPPK -> "PNS"
// 2. Education < S1 -> "Tendik" (unless explicitly PNS)
// 3. TMT >= 2 Years -> "GTY"
// 4. Default -> "GTT"

export function determineTeacherStatus(teacher: any): string {
    // 0. Safety Check
    if (!teacher) return "GTT";

    const rawStatus = (teacher.status || "").trim().toUpperCase();
    
    // Priority 1: Check Explicit PNS/ASN
    if (rawStatus.includes("PNS") || rawStatus.includes("ASN") || rawStatus.includes("PPPK") || rawStatus.includes("CPNS")) {
        return "PNS";
    } 

    // Priority 2: Check Education (Tendik if < S1)
    // Common non-degree patterns
    const tendikEdu = ["SD", "SMP", "SMA", "SMK", "D1", "D2", "D3", "MA ", "MTS ", "MI ", "PAKET"];
    const edu = (teacher.pendidikanTerakhir || "").trim().toUpperCase();

    // Check if education matches any Tendik pattern
    const isTendikEdu = tendikEdu.some(e => edu === e || edu.startsWith(e + " ") || edu.includes(e));
    
    // Explicit Role check for Tendik
    const isTendikRole = rawStatus.includes("TENDIK") || rawStatus.includes("TU") || rawStatus.includes("OPERATOR") || rawStatus.includes("PENJAGA") || rawStatus.includes("KEAMANAN");

    if (isTendikEdu || isTendikRole) {
       return "Tendik";
    }

    // Priority 3: Check TMT for GTY/GTT
    if (teacher.tmt) {
       const tmtDate = new Date(teacher.tmt);
       if (!isNaN(tmtDate.getTime())) {
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - tmtDate.getTime());
          const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
          return diffYears >= 2 ? "GTY" : "GTT";
       }
    }

    // Fallback if no TMT
    if (rawStatus.includes("GTY") || rawStatus.includes("TETAP")) return "GTY";
    
    return "GTT";
}
