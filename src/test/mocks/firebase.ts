// Centralised mock for src/lib/firebase.ts.
// Real Firebase init reads from import.meta.env and connects emulators,
// neither of which we want during unit tests. Returning bare sentinels is
// enough because every Firestore/Functions call is itself mocked.
export const auth = { currentUser: null } as unknown as object;
export const db = { __type: "mock-db" } as unknown as object;
export const storage = { __type: "mock-storage" } as unknown as object;
export const functions = { __type: "mock-functions" } as unknown as object;
export const googleProvider = { __type: "mock-google" } as unknown as object;
