import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const client = new ConvexHttpClient(deploymentUrl);

async function run() {
    console.log("Starting test...");
    try {
        // 1. Get a student
        const student = await client.query(api.debug.getFirst);
        if (!student) {
            console.error("No students found in DB. Please add one first.");
            return;
        }

        console.log(`Found student: ${student.nama} (${student._id})`);

        // 2. Try to update
        console.log("Attempting update...");
        const result = await client.mutation(api.students.update, {
            id: student._id,
            nama: student.nama + " (Test Update)"
        });

        console.log("Update success!", result);
    } catch (e: any) {
        console.error("Update FAILED:", e.message);
    }
}

run();
