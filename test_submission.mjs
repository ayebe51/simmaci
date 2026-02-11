
const CONVEX_URL = "https://successful-bison-83.convex.cloud";

async function run() {
  console.log("Using URL:", CONVEX_URL);

  // 1. Get Teachers
  console.log("Fetching teachers...");
  const tRes = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "teachers:list", args: {} })
  });
  const tJson = await tRes.json();
  if (tJson.status !== "success" || tJson.value.length === 0) {
      console.error("Failed to fetch teachers", tJson);
      return;
  }
  const teacher = tJson.value[0];
  console.log("Teacher:", teacher.nama, teacher._id);

  // 2. Get Schools
  console.log("Fetching schools...");
  const sRes = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "schools:list", args: {} })
  });
  const sJson = await sRes.json();
  if (sJson.status !== "success" || sJson.value.length === 0) {
      console.error("Failed to fetch schools", sJson);
      return;
  }
  const school = sJson.value[0];
  console.log("School:", school.nama, school._id);

  // 3. Submit Mutation
  console.log("Submitting Mutation...");
  const mutationRes = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          path: "headmasters:create",
          args: {
            teacherId: teacher._id,
            teacherName: teacher.nama,
            schoolId: school._id,
            schoolName: school.nama,
            periode: 1,
            startDate: "2024-01-01",
            endDate: "2028-01-01",
            status: "pending",
            // No token -> Expect Unauthorized
          }
      })
  });
  
  const mJson = await mutationRes.json();
  console.log("Mutation Response:", JSON.stringify(mJson, null, 2));
}

run();
