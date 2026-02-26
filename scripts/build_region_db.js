const fs = require('fs');

const REGENCY_ID = '3301'; // Kemendagri ID for Cilacap

// Capitalize words properly
function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(function(word) {
    if (word.length === 0) return word;
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}

async function buildCilacapDb() {
  console.log("Fetching Districts for Cilacap (3301)...");
  
  try {
      const distRes = await fetch(`https://kanglerian.github.io/api-wilayah-indonesia/api/districts/${REGENCY_ID}.json`);
      const districts = await distRes.json();
      
      const finalData = {
        provinsi: "Jawa Tengah",
        kabupaten: "Cilacap",
        kecamatan: []
      };

      for (const dist of districts) {
         console.log(`Fetching Villages for ${dist.name}...`);
         const vilRes = await fetch(`https://kanglerian.github.io/api-wilayah-indonesia/api/villages/${dist.id}.json`);
         const villages = await vilRes.json();
         
         finalData.kecamatan.push({
           nama: titleCase(dist.name),
           desa: villages.map(v => titleCase(v.name)).sort()
         });
      }
      
      // Sort districts alphabetically
      finalData.kecamatan.sort((a, b) => a.nama.localeCompare(b.nama));

      fs.writeFileSync('public/data/cilacap.json', JSON.stringify(finalData, null, 2));
      console.log(`Successfully built complete Cilacap database (${finalData.kecamatan.length} Kecamatan) to public/data/cilacap.json`);
  } catch (err) {
      console.error("Failed to build DB:", err);
  }
}

buildCilacapDb();
