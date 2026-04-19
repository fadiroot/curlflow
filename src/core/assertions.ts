import type { Assert } from "../schema.js";
import type { AssertionResult, HttpResponse } from "../types.js";
import { extract } from "./extractor.js";

export function runAssertions(
  expect: Assert | undefined,
  res: HttpResponse
): AssertionResult[] {
  if (!expect) return [];
  const results: AssertionResult[] = [];

  if (expect.status !== undefined) {
    const allowed = Array.isArray(expect.status)
      ? expect.status
      : [expect.status];
    const ok = allowed.includes(res.status);
    results.push({
      ok,
      field: "status",
      expected: expect.status,
      actual: res.status,
      message: ok
        ? undefined
        : `Expected status ${JSON.stringify(expect.status)}, got ${res.status}`,
    });
  }

  if (expect.headers) {
    for (const [name, expected] of Object.entries(expect.headers)) {
      const actual = res.headers[name.toLowerCase()];
      const ok = actual !== undefined && actual.includes(expected);
      results.push({
        ok,
        field: `headers.${name}`,
        expected,
        actual,
        message: ok
          ? undefined
          : `Header "${name}" expected to contain "${expected}", got "${actual ?? "<missing>"}"`,
      });
    }
  }

  if (expect.body) {
    if (expect.body.equals !== undefined) {
      const ok = deepEqual(res.body, expect.body.equals);
      results.push({
        ok,
        field: "body.equals",
        expected: expect.body.equals,
        actual: res.body,
        message: ok ? undefined : "Body does not match expected value",
      });
    }
    if (expect.body.contains !== undefined) {
      const ok = deepContains(res.body, expect.body.contains);
      results.push({
        ok,
        field: "body.contains",
        expected: expect.body.contains,
        actual: res.body,
        message: ok ? undefined : "Body does not contain expected subset",
      });
    }
    if (expect.body.jsonPath) {
      for (const [path, expected] of Object.entries(expect.body.jsonPath)) {
        const actual = extract(res.body, path);
        const ok = matches(actual, expected);
        results.push({
          ok,
          field: `body.jsonPath.${path}`,
          expected,
          actual,
          message: ok
            ? undefined
            : `JSONPath "${path}" expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        });
      }
    }
  }

  return results;
}

function matches(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const exp = expected as Record<string, unknown>;
    if ("exists" in exp) {
      const shouldExist = !!exp.exists;
      const exists = actual !== undefined && actual !== null;
      return shouldExist ? exists : !exists;
    }
    if ("type" in exp) {
      return typeName(actual) === exp.type;
    }
    if ("regex" in exp && typeof exp.regex === "string") {
      return typeof actual === "string" && new RegExp(exp.regex).test(actual);
    }
    if ("contains" in exp) {
      return deepContains(actual, exp.contains);
    }
    if ("equals" in exp) {
      return deepEqual(actual, exp.equals);
    }
  }
  return deepEqual(actual, expected);
}

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length) return false;
    if (!ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k]
      )
    );
  }
  return false;
}

/** Checks that `superset` contains every key/value of `subset` (recursively). */
export function deepContains(superset: unknown, subset: unknown): boolean {
  if (deepEqual(superset, subset)) return true;
  if (typeof superset !== "object" || superset === null) return false;
  if (typeof subset !== "object" || subset === null) return false;

  if (Array.isArray(subset)) {
    if (!Array.isArray(superset)) return false;
    return subset.every((el) =>
      superset.some((s) => deepContains(s, el))
    );
  }

  for (const [k, v] of Object.entries(subset as Record<string, unknown>)) {
    const sv = (superset as Record<string, unknown>)[k];
    if (!deepContains(sv, v)) return false;
  }
  return true;
}
