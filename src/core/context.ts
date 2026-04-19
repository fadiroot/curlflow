/**
 * Runtime context: resolves ${var} and ${env.NAME} in strings, objects, arrays.
 * Unknown references are left as-is unless `strict` is true.
 */
export interface ContextOptions {
  vars: Record<string, unknown>;
  env: Record<string, string>;
  strict?: boolean;
}

const REF = /\$\{([^}]+)\}/g;

export class Context {
  vars: Record<string, unknown>;
  env: Record<string, string>;
  strict: boolean;

  constructor(opts: ContextOptions) {
    this.vars = { ...opts.vars };
    this.env = { ...opts.env };
    this.strict = !!opts.strict;
  }

  set(key: string, value: unknown) {
    this.vars[key] = value;
  }

  get(key: string): unknown {
    if (key.startsWith("env.")) return this.env[key.slice(4)];
    return this.lookup(this.vars, key);
  }

  private lookup(root: unknown, path: string): unknown {
    const parts = path.split(".");
    let cur: unknown = root;
    for (const p of parts) {
      if (cur == null) return undefined;
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  /** Interpolate a string: replaces ${x} with value. If the WHOLE string is a single ${x}, returns the raw value (preserving type). */
  interpolateString(input: string): unknown {
    const whole = input.match(/^\$\{([^}]+)\}$/);
    if (whole) {
      const val = this.get(whole[1]);
      if (val === undefined) {
        if (this.strict)
          throw new Error(`Undefined variable: ${whole[1]}`);
        return input;
      }
      return val;
    }
    return input.replace(REF, (_m, name) => {
      const val = this.get(name);
      if (val === undefined) {
        if (this.strict) throw new Error(`Undefined variable: ${name}`);
        return `\${${name}}`;
      }
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    });
  }

  /** Recursively interpolate any value. */
  interpolate<T = unknown>(value: T): T {
    if (value == null) return value;
    if (typeof value === "string") return this.interpolateString(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.interpolate(v)) as T;
    if (typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[this.interpolateString(k) as string] = this.interpolate(v);
      }
      return out as T;
    }
    return value;
  }

  /** Evaluate a simple boolean expression for skipIf: supports !var, var, var==value, var!=value. */
  evalCondition(expr: string): boolean {
    const e = expr.trim();
    const negate = e.startsWith("!");
    const body = negate ? e.slice(1).trim() : e;

    const eq = body.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
    if (eq) {
      const lhs = this.coerce(this.interpolateString(eq[1].trim()));
      const rhs = this.coerce(this.interpolateString(eq[3].trim().replace(/^['"]|['"]$/g, "")));
      const result = eq[2] === "==" ? lhs === rhs : lhs !== rhs;
      return negate ? !result : result;
    }

    const val = this.get(body);
    const truthy = val !== undefined && val !== null && val !== "" && val !== false;
    return negate ? !truthy : truthy;
  }

  private coerce(v: unknown): unknown {
    if (typeof v !== "string") return v;
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "null") return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }
}
