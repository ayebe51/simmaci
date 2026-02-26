import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Mock json mapping since backend can't easily fetch public files
// We only need valid kecamatan names to match against old typo text
const VALID_KECAMATAN = [
  "Adipala", "Bantarsari", "Binangun", "Cilacap Selatan", "Cilacap Tengah",
  "Cilacap Utara", "Cimanggu", "Cipari", "Dayeuhluhur", "Gandrungmangu",
  "Jeruklegi", "Kampung Laut", "Karangpucung", "Kawunganten", "Kedungreja",
  "Kesugihan", "Kroya", "Majenang", "Maos", "Nusawungu", "Patimuan",
  "Sampang", "Sidareja", "Wanareja"
];

// Simple fuzzy search basic algorithm (Levenshtein distance could be used, but let's try includes/contains first)
function findBestKecamatanMatch(input: string | undefined): string | null {
  if (!input) return null;
  const normalizedMatch = input.toLowerCase().replace(/kec\.|kecamatan/, '').trim();
  
  for (const valid of VALID_KECAMATAN) {
       if (valid.toLowerCase() === normalizedMatch || valid.toLowerCase().includes(normalizedMatch) || normalizedMatch.includes(valid.toLowerCase())) {
           return valid;
       }
  }
  return null;
}

export const migrateSchoolAddresses = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting School Address Migration...");
    const schools = await ctx.db.query("schools").collect();
    
    let updatedCount = 0;
    const failedNames: string[] = [];

    for (const school of schools) {
      if (school.provinsi === "Jawa Tengah" && school.kabupaten === "Cilacap" && VALID_KECAMATAN.includes(school.kecamatan || "")) {
         continue; // Already migrated or perfectly set
      }

      const updates: any = {
         provinsi: "Jawa Tengah",
         kabupaten: "Cilacap",
      };

      const bestMatch = findBestKecamatanMatch(school.kecamatan);
      if (bestMatch) {
          updates.kecamatan = bestMatch;
          await ctx.db.patch(school._id, updates);
          updatedCount++;
      } else {
          // Update province and regency even if district isn't matched
          await ctx.db.patch(school._id, updates);
          failedNames.push(`${school.nama} (Old: ${school.kecamatan})`);
          updatedCount++; // It's still an update
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} schools.`);
    console.log(`Unmatched kecamatan (required manual review):`, failedNames);

    return {
        success: true,
        updatedCount,
        unmatched: failedNames
    };
  }
});
