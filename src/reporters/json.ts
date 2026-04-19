import type { FlowResult } from "../types.js";

/**
 * Cursor-friendly JSON output. Designed so the AI can quickly see failures
 * without noise. Response bodies are truncated by default.
 */
export function toCursorJSON(result: FlowResult, verbose = false): unknown {
  return {
    flow: result.name,
    ok: result.ok,
    durationMs: result.durationMs,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    summary: {
      total: result.steps.length,
      passed: result.steps.filter((s) => s.ok && !s.skipped).length,
      failed: result.steps.filter((s) => !s.ok).length,
      skipped: result.steps.filter((s) => s.skipped).length,
    },
    steps: result.steps.map((s) => ({
      index: s.index,
      name: s.name,
      ok: s.ok,
      skipped: s.skipped,
      skipReason: s.skipReason,
      error: s.error,
      request: {
        method: s.request.method,
        url: s.request.url,
        headers: verbose ? s.request.headers : undefined,
        body: verbose ? s.request.body : undefined,
      },
      response: s.response
        ? {
            status: s.response.status,
            durationMs: s.response.durationMs,
            headers: verbose ? s.response.headers : undefined,
            body: verbose
              ? s.response.body
              : s.ok
                ? undefined
                : truncate(s.response.body),
          }
        : undefined,
      failedAssertions: s.assertions.filter((a) => !a.ok),
      extracted: Object.keys(s.extracted).length > 0 ? s.extracted : undefined,
    })),
    vars: verbose ? result.vars : undefined,
  };
}

function truncate(body: unknown): unknown {
  if (typeof body === "string")
    return body.length > 2000 ? body.slice(0, 2000) + "…" : body;
  try {
    const s = JSON.stringify(body);
    if (s.length <= 4000) return body;
    return { _truncated: true, preview: s.slice(0, 4000) };
  } catch {
    return body;
  }
}
