import type { Flow, Step } from "../schema.js";
import type { FlowResult, StepResult, HttpResponse } from "../types.js";
import { Context } from "./context.js";
import { buildUrl, sendRequest } from "./http.js";
import { runAssertions } from "./assertions.js";
import { extract } from "./extractor.js";

export interface ExecuteOptions {
  env: Record<string, string>;
  strict?: boolean;
  stopOnFail?: boolean;
  onStepStart?: (step: Step, index: number) => void;
  onStepEnd?: (result: StepResult) => void;
}

export async function executeFlow(
  flow: Flow,
  opts: ExecuteOptions
): Promise<FlowResult> {
  const ctx = new Context({
    vars: { ...(flow.vars ?? {}) },
    env: { ...opts.env, ...(flow.env ?? {}) },
    strict: opts.strict,
  });

  const startedAt = new Date();
  const baseUrl = flow.baseUrl
    ? (ctx.interpolateString(flow.baseUrl) as string)
    : undefined;

  const baseHeaders = flow.headers
    ? (ctx.interpolate(flow.headers) as Record<string, string>)
    : {};

  const authHeaders = buildAuthHeaders(flow, ctx);

  const stepResults: StepResult[] = [];
  let flowOk = true;

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    opts.onStepStart?.(step, i);

    if (step.skipIf) {
      const expr = ctx.interpolateString(step.skipIf) as string;
      if (ctx.evalCondition(expr)) {
        const r: StepResult = {
          name: step.name,
          index: i,
          ok: true,
          skipped: true,
          skipReason: `skipIf: ${step.skipIf}`,
          request: { method: step.method, url: "", headers: {} },
          assertions: [],
          extracted: {},
        };
        stepResults.push(r);
        opts.onStepEnd?.(r);
        continue;
      }
    }

    const result = await runStep(step, i, {
      baseUrl,
      baseHeaders: { ...baseHeaders, ...authHeaders },
      ctx,
    });

    stepResults.push(result);
    opts.onStepEnd?.(result);

    if (!result.ok) {
      flowOk = false;
      if (opts.stopOnFail !== false) break;
    }
  }

  const finishedAt = new Date();
  return {
    name: flow.name,
    ok: flowOk,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    steps: stepResults,
    vars: ctx.vars,
  };
}

interface RunStepEnv {
  baseUrl: string | undefined;
  baseHeaders: Record<string, string>;
  ctx: Context;
}

async function runStep(
  step: Step,
  index: number,
  env: RunStepEnv
): Promise<StepResult> {
  const { ctx, baseUrl, baseHeaders } = env;

  const pathOrUrl = (ctx.interpolate(step.url ?? step.path!) as string) ?? "";
  const query = step.query
    ? (ctx.interpolate(step.query) as Record<
        string,
        string | number | boolean
      >)
    : undefined;
  const url = buildUrl(baseUrl, pathOrUrl, query);
  const headers = {
    ...baseHeaders,
    ...((step.headers
      ? (ctx.interpolate(step.headers) as Record<string, string>)
      : {}) as Record<string, string>),
  };
  const body =
    step.body !== undefined ? ctx.interpolate(step.body) : undefined;
  const form = step.form
    ? (ctx.interpolate(step.form) as Record<string, string>)
    : undefined;

  const maxAttempts = (step.retries ?? 0) + 1;
  let lastError: unknown;
  let response: HttpResponse | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      response = await sendRequest({
        method: step.method,
        url,
        headers,
        body,
        form,
        timeoutMs: step.timeoutMs,
      });
      lastError = undefined;
      break;
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts - 1) break;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }

  if (!response) {
    return {
      name: step.name,
      index,
      ok: false,
      skipped: false,
      request: { method: step.method, url, headers, body },
      assertions: [],
      extracted: {},
      error:
        lastError instanceof Error ? lastError.message : String(lastError),
    };
  }

  const expectInterpolated = step.expect
    ? (ctx.interpolate(step.expect) as typeof step.expect)
    : undefined;
  const assertions = runAssertions(expectInterpolated, response);
  const extracted: Record<string, unknown> = {};
  if (step.extract) {
    for (const [name, expr] of Object.entries(step.extract)) {
      const val = extract(response.body, expr);
      extracted[name] = val;
      ctx.set(name, val);
    }
  }

  const ok = assertions.every((a) => a.ok);

  return {
    name: step.name,
    index,
    ok,
    skipped: false,
    request: { method: step.method, url, headers, body },
    response,
    assertions,
    extracted,
  };
}

function buildAuthHeaders(
  flow: Flow,
  ctx: Context
): Record<string, string> {
  if (!flow.auth) return {};
  const a = flow.auth;
  if (a.type === "bearer" && a.token) {
    const token = ctx.interpolateString(a.token) as string;
    return { authorization: `Bearer ${token}` };
  }
  if (a.type === "basic" && a.username) {
    const u = ctx.interpolateString(a.username) as string;
    const p = ctx.interpolateString(a.password ?? "") as string;
    const b64 = Buffer.from(`${u}:${p}`).toString("base64");
    return { authorization: `Basic ${b64}` };
  }
  if (a.type === "header" && a.header && a.value) {
    return {
      [a.header.toLowerCase()]: ctx.interpolateString(a.value) as string,
    };
  }
  return {};
}
