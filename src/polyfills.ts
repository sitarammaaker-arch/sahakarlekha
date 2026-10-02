/**
 * Runtime polyfills for older browsers (Phase-2 G1 / audit OPS-01).
 *
 * error_log (14 days to 2026-10-01): "this.o.at is not a function" ×22 and "Object.hasOwn is not a
 * function" ×11 — Chrome < 92 / Safari < 15.4 / older Android WebViews, common on low-cost phones.
 * A build target cannot fix these: esbuild transpiles SYNTAX, not missing built-in METHODS, and they
 * are called from our code and from dependencies alike. So the methods are defined here, once, before
 * anything else runs (imported first in main.tsx). Each is a no-op where the browser already has it,
 * and each follows the spec's semantics (relative indexing; own-property check).
 */

type AtCapable = { length: number; [i: number]: unknown };

function at(this: AtCapable, index: number): unknown {
  const len = this.length >>> 0;
  let i = Math.trunc(Number(index)) || 0;
  if (i < 0) i += len;
  return i < 0 || i >= len ? undefined : this[i];
}

function define(target: object, name: string, value: unknown) {
  if (!(name in target)) Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false });
}

define(Array.prototype, 'at', at);
define(String.prototype, 'at', function (this: string, index: number) { return at.call(String(this) as unknown as AtCapable, index); });
const TypedArrayProto = Object.getPrototypeOf(Int8Array.prototype);
if (TypedArrayProto) define(TypedArrayProto, 'at', at);

define(Object, 'hasOwn', (obj: object, key: PropertyKey) => {
  if (obj == null) throw new TypeError('Cannot convert undefined or null to object');
  return Object.prototype.hasOwnProperty.call(Object(obj), key);
});

define(Array.prototype, 'findLast', function <T>(this: T[], pred: (v: T, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (pred.call(thisArg, this[i], i, this)) return this[i];
  return undefined;
});
define(Array.prototype, 'findLastIndex', function <T>(this: T[], pred: (v: T, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (pred.call(thisArg, this[i], i, this)) return i;
  return -1;
});

export {};
