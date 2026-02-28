// @ts-nocheck
import { query } from "./_generated/server";

export const debugTest = query({
  args: {},
  handler: async (ctx) => {
    return [
      { 
        action: "Fix Mode", 
        details: "If you see this, then we bypassed the logs.ts error", 
        timestamp: Date.now() 
      }
    ];
  },
});
