
import fs from 'fs';
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run() {
  console.log(`Checking SK DOCUMENTS from ${CONVEX_URL}...`);
  try {
      const response = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "User-Agent": "Node-Debug-Script"
        },
        body: JSON.stringify({
          path: "sk:debugListAllSk", 
          args: {},
          format: "json"
        }),
      });

      if (!response.ok) {
          console.error("HTTP Error:", await response.text());
          return;
      }

      const json = await response.json();
      const allSk = json.value;
      
      console.log(`Total SK Documents: ${allSk.length}`);

      // Group by unitKerja
      const unitCounts = {};
      allSk.forEach(sk => {
          const u = sk.unitKerja || "UNDEFINED";
          unitCounts[u] = (unitCounts[u] || 0) + 1;
      });

      const output = `
DEBUG REPORT: SK Data Summary (${new Date().toISOString()})
-----------------------------
Total SKs: ${allSk.length}
By Unit Kerja:
${JSON.stringify(unitCounts, null, 2)}
      `;

      // Write to file
      fs.writeFileSync('debug_sks_summary.txt', output);
      console.log("Summary written to debug_sks_summary.txt");

  } catch (e) {
      console.error("Error:", e);
  }
}

run();
