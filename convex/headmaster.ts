import { query } from "./_generated/server";
import { v } from "convex/values";

export const getExpiringHeadmasters = query({
  args: {
    thresholdDays: v.optional(v.number()), // Alert threshold (default 365)
  },
  handler: async (ctx, args) => {
    // 1. Get all teachers who are "Kepala Madrasah"
    // We filter by jabatan or jenisSk query if possible, or filter in memory
    const teachers = await ctx.db.query("teachers")
        .withIndex("by_active", q => q.eq("isActive", true))
        .collect();
    
    const headmasters = teachers.filter(t => {
        const jab = (t.mapel || "").toLowerCase(); // mapel often stores Jabatan for Kamad
        const stat = (t.status || "").toLowerCase();
        // Check keywords
        return jab.includes("kepala") || stat.includes("kepala") || stat.includes("kamad");
    });

    const now = new Date();
    const threshold = args.thresholdDays || 365;
    
    // 2. Calculate Tenure
    const alerts = headmasters.map(h => {
        if (!h.tmt) return null;
        
        // Parse TMT
        const tmtDate = new Date(h.tmt); // Assuming ISO or valid string
        if (isNaN(tmtDate.getTime())) return null;

        // One period = 4 Years
        // Identify current period based on TMT vs Now
        const diffYears = (now.getTime() - tmtDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const currentPeriod = Math.floor(diffYears / 4) + 1;
        
        // If Period > 3, they are EXCEEDED (Max 3)
        // Expiry of CURRENT period
        const periodEndYear = tmtDate.getFullYear() + (currentPeriod * 4);
        const expiryDate = new Date(tmtDate);
        expiryDate.setFullYear(periodEndYear);

        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Determine Status
        let status = "safe";
        if (currentPeriod > 3) status = "limit_exceeded"; // Sudah lebih 3 periode
        else if (diffDays <= 0) status = "expired";
        else if (diffDays <= threshold) status = "warning";
        else return null; // Safe, no alert

        return {
            id: h._id,
            nama: h.nama,
            unitKerja: h.unitKerja,
            tmt: h.tmt,
            periode: currentPeriod,
            expiryDate: expiryDate.toISOString(),
            daysRemaining: diffDays,
            status,
            maxPeriode: 3
        };
    }).filter(item => item !== null);

    // Sort: Expired first, then Warning
    return alerts.sort((a, b) => (a?.daysRemaining || 0) - (b?.daysRemaining || 0));
  }
});
