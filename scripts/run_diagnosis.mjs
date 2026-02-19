
import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";

// Manually read .env.local to get VITE_CONVEX_URL
const envPath = path.resolve(process.cwd(), ".env.local");
let convexUrl = "";

// Hardcode PROD URL for diagnosis
convexUrl = "https://successful-bison-83.convex.cloud";

console.log("Using Convex URL:", convexUrl);
const client = new ConvexHttpClient(convexUrl);

async function runDiagnosis() {
  console.log("Starting Diagnosis...");
  const results = {
    teachers: { total: 0, mixed: 0, errors: [], samples: [] },
    users: { total: 0, mixed: 0, errors: [], samples: [] },
    skDocuments: { total: 0, mixed: 0, errors: [], samples: [] },
  };

  // --- TEACHERS ---
  console.log("Checking Teachers...");
  let cursor = null;
  let isDone = false;
  
  while (!isDone) {
    const response = await client.query("debug_final:checkTeachersPaginated", { cursor });
    
    for (const item of response.items) {
        results.teachers.total++;
        const val = item.schoolIdVal;
        
        // Capture samples
        if (results.teachers.samples.length < 5) {
            results.teachers.samples.push({ id: item.id, val: val, type: typeof val });
        }

        // Log if it's NOT a valid ID string (simple heuristic: spaces, or not 32 chars specific format if known, but spaces is good enough for now)
        // Convex IDs are alphanumeric string. School names usually have spaces "MI ...".
        const isLikelyName = typeof val === 'string' && val.includes(" ");
        
        if (isLikelyName) {
            results.teachers.errors.push({ id: item.id, val: val, type: typeof val });
            results.teachers.mixed++;
        }
    }

    cursor = response.continueCursor;
    isDone = response.pageStatus === "Done";
    process.stdout.write(`.`);
  }
  console.log(`\nTeachers Checked: ${results.teachers.total}. Suspicious: ${results.teachers.mixed}`);

  // --- USERS ---
  console.log("Checking Users...");
  cursor = null;
  isDone = false;
  
  while (!isDone) {
      const response = await client.query("debug_final:checkUsersPaginated", { cursor });
      for (const item of response.items) {
          results.users.total++;
          const val = item.schoolIdVal;

          // Capture samples
          if (results.users.samples.length < 5) {
              results.users.samples.push({ id: item.id, val: val, type: typeof val });
          }

          const isLikelyName = typeof val === 'string' && val.includes(" ");
          if (isLikelyName) {
              results.users.errors.push({ id: item.id, val: val, type: typeof val, email: item.email });
              results.users.mixed++;
          }
      }
      cursor = response.continueCursor;
      isDone = response.pageStatus === "Done";
      process.stdout.write(`.`);
  }
  console.log(`\nUsers Checked: ${results.users.total}. Suspicious: ${results.users.mixed}`);

  // --- SK DOCUMENTS ---
  console.log("Checking SK Documents...");
  cursor = null;
  isDone = false;
  
  while (!isDone) {
      const response = await client.query("debug_final:checkSkPaginated", { cursor });
      for (const item of response.items) {
          results.skDocuments.total++;
          const val = item.schoolIdVal;

          // Capture samples
          if (results.skDocuments.samples.length < 5) {
              results.skDocuments.samples.push({ id: item.id, val: val, type: typeof val });
          }

           // SK documents might use string names legitimately in some versions? 
           // But we want to move to IDs.
           // Let's log if it's NOT an ID.
           const isLikelyId = typeof val === 'string' && !val.includes(" ");
           if (!isLikelyId && val) {
               results.skDocuments.errors.push({ id: item.id, val: val, type: typeof val });
               results.skDocuments.mixed++;
           }
      }
      cursor = response.continueCursor;
      isDone = response.pageStatus === "Done";
      process.stdout.write(`.`);
  }
  console.log(`\nSK Documents Checked: ${results.skDocuments.total}. Suspicious (Not ID): ${results.skDocuments.mixed}`);
  console.log("\n--- SAMPLES (First 5) ---");
  console.log("Teachers:", results.teachers.samples || []);
  console.log("Users:", results.users.samples || []);
  console.log("SK Documents:", results.skDocuments.samples || []);
  
  // Save to file
  fs.writeFileSync("diagnosis_report.json", JSON.stringify(results, null, 2));
  console.log("Report saved to diagnosis_report.json");
}

runDiagnosis().catch(console.error);
