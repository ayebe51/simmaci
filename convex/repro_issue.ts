
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const testTeacherUpdate = mutation({
  args: { 
      teacherId: v.id("teachers"),
      testEmptySchoolId: v.optional(v.boolean()) 
  },
  handler: async (ctx, args) => {
    console.log("TEST: Updating teacher...");

    const updates: any = {
        updatedAt: Date.now()
    };

    if (args.testEmptySchoolId) {
        console.log("TEST: Sending schoolId = '' (Should fail with Strict Schema)");
        updates.schoolId = ""; // This should TRAP valid ID check
    }

    try {
        await ctx.db.patch(args.teacherId, updates);
        console.log("TEST: Teacher Update SUCCESS");
        return "SUCCESS";
    } catch (e: any) {
        console.error("TEST: Teacher Update FAILED", e);
        return `FAILED: ${e.message}`; // Expected if strict schema works
    }
  }
});

export const testSkGen = mutation({
  args: { testEmptySchoolId: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    console.log("TEST: Generating SK...");
    try {
        const doc: any = {
            nomorSk: `TEST-SK-${Date.now()}`,
            jenisSk: "Penetapan",
            nama: "Test Teacher",
            status: "draft"
        };
        
        if (args.testEmptySchoolId) {
             console.log("TEST: Sending schoolId = '' in SK (Should fail)");
             doc.schoolId = ""; 
        }

        // We can't easily force bulkCreate to accept schoolId="" because validation happens at Argument level
        // But we can try to Insert directly here to mimic what might happen internally if logic is flawed
        
        await ctx.db.insert("skDocuments", doc);

        console.log("TEST: SK Gen SUCCESS");
        return "SUCCESS";
    } catch (e: any) {
        console.error("TEST: SK Gen FAILED", e);
        return `FAILED: ${e.message}`;
    }
  }
});
