import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/ping",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response("pong", { status: 200 });
  }),
});

http.route({
  path: "/test-repro",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Pick a teacher to test with
    const teacher = await ctx.runQuery(api.teachers.list, { paginationOpts: { numItems: 1, cursor: null } });
    const tId = teacher.page[0]?._id;
    
    if (!tId) return new Response("No teachers found to test", { status: 404 });

    const res1 = await ctx.runMutation(api.repro_issue.testTeacherUpdate, { teacherId: tId, testEmptySchoolId: true });
    const res2 = await ctx.runMutation(api.repro_issue.testSkGen, { testEmptySchoolId: true });
    
    return new Response(JSON.stringify({ teacherUpdate: res1, skGen: res2 }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
