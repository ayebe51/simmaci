
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("./convex/_generated/api.js");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function run() {
  try {
    console.log("Fetching teachers...");
    const teachers = await client.query(api.teachers.list);
    if (teachers.length === 0) throw new Error("No teachers found");
    const teacher = teachers[0];
    console.log("Teacher found:", teacher.nama, teacher._id);

    console.log("Fetching schools...");
    const schools = await client.query(api.schools.list);
    if (schools.length === 0) throw new Error("No schools found");
    const school = schools[0];
    console.log("School found:", school.nama, school._id);

    console.log("Attempting submission without token (should fail Unauthorized)...");
    try {
        await client.mutation(api.headmasters.create, {
            teacherId: teacher._id,
            teacherName: teacher.nama,
            schoolId: school._id,
            schoolName: school.nama,
            periode: 1,
            startDate: "2024-01-01",
            endDate: "2028-01-01",
            status: "pending",
        });
    } catch (e) {
        console.log("Expected Error:", e.message);
        console.log("Full Error Object:", JSON.stringify(e, null, 2));
    }

  } catch (err) {
    console.error("Script Error:", err);
  }
}

run();
