import { query } from "./_generated/server";

export const test = query({
  args: {},
  handler: async () => {
    return "WORKING";
  }
});
