
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const client = new ConvexHttpClient("https://uncommon-dachshund-623.convex.cloud");

async function check() {
    console.log("Checking teachers:list on Production...");
    try {
        const teachers = await client.query(api.teachers.list, { unitKerja: undefined, kecamatan: undefined, isCertified: "all", token: "test-token" });
        console.log("Teachers Result:", teachers.length, "teachers found");
    } catch (error) {
        console.error("Teachers Query Failed:", error);
    }

    console.log("Checking schools:list on Production...");
    try {
        const schools = await client.query(api.schools.list, { kecamatan: undefined, token: "test-token" });
        console.log("Schools Result:", schools.length, "schools found");
    } catch (error) {
        console.error("Schools Query Failed:", error);
    }
}

check();
