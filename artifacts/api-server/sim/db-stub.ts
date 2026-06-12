/* eslint-disable @typescript-eslint/no-explicit-any */
// Stub for @workspace/db used ONLY by the stress harness. Lets the real sync
// logic (endSprint, finalizeSprintData, settleBets…) run while every DB call
// is a harmless no-op resolving to []. No database required.

function makeChain(): any {
  // Resolves to [] when awaited, and supports real .then()/.catch()/.finally()
  // chaining (persistRoom uses `.then().catch()`, not await). Every other
  // property is a method that returns the same chain (drizzle's builder API).
  const resolved = Promise.resolve([] as unknown[]);
  const chain: any = new Proxy(function () { return chain; }, {
    get(_t, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return (resolved as any)[prop].bind(resolved);
      }
      if (prop === Symbol.toPrimitive) return () => "";
      return (..._args: unknown[]) => chain;
    },
    apply() { return chain; },
  });
  return chain;
}

export const db: any = makeChain();

export const pool: any = {
  query: async () => ({ rows: [] }),
  connect: async () => ({ query: async () => ({ rows: [] }), release() {} }),
};

const tableProxy = (): any => new Proxy({}, { get: (_t, p) => ({ name: String(p) }) });
export const roomsTable: any = tableProxy();
export const userProfilesTable: any = tableProxy();
export const sprintWritingTable: any = tableProxy();
