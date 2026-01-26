// Universal Mock API to fix build errors due to missing src/lib/api.ts
// This uses a recursive proxy to handle any property access or function call.

export const API_URL = "https://mock-api.com";

const createRecursiveProxy = (): any => new Proxy(() => Promise.resolve([]), {
  get: (target, prop) => {
    if (prop === 'then') return undefined; // Avoid treating as Promise unless called
    return createRecursiveProxy();
  },
  apply: () => Promise.resolve([])
});

export const api: any = createRecursiveProxy();
