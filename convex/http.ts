import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/ping",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response("pong", { status: 200 });
  }),
});

export default http;
