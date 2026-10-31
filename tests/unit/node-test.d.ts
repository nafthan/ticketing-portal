/* Minimal types for the Node built-ins the unit tests use (@types/node isn't a dependency). */
declare module "node:test" {
  const test: (name: string, fn: (t?: any) => any) => any;
  export default test;
  export const describe: (name: string, fn: () => any) => any;
  export const beforeEach: (fn: () => any) => any;
}
declare module "node:assert/strict" {
  const assert: {
    (v: unknown, msg?: string): void;
    equal(a: unknown, b: unknown, msg?: string): void;
    notEqual(a: unknown, b: unknown, msg?: string): void;
    deepEqual(a: unknown, b: unknown, msg?: string): void;
    match(s: string, re: RegExp, msg?: string): void;
    ok(v: unknown, msg?: string): void;
  };
  export default assert;
}
