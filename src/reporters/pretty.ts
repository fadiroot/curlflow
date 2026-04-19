import pc from "picocolors";
import type { FlowResult, StepResult } from "../types.js";

export function printStepStart(name: string, index: number, method: string) {
  process.stdout.write(
    `${pc.dim(`[${index + 1}]`)} ${pc.bold(name)} ${pc.dim(`(${method})`)}`
  );
}

export function printStepEnd(result: StepResult) {
  const status = result.response?.status;
  const ms = result.response?.durationMs;
  const tag = result.skipped
    ? pc.yellow("SKIP")
    : result.ok
      ? pc.green("PASS")
      : pc.red("FAIL");
  const meta =
    status !== undefined
      ? pc.dim(` ${status} · ${ms}ms`)
      : result.error
        ? pc.red(` error`)
        : "";
  process.stdout.write(`  ${tag}${meta}\n`);

  if (result.error) {
    console.log(pc.red(`    error: ${result.error}`));
  }

  for (const a of result.assertions) {
    if (a.ok) continue;
    console.log(pc.red(`    ✗ ${a.field}: ${a.message ?? "assertion failed"}`));
    if (a.expected !== undefined) {
      console.log(
        pc.dim(`      expected: `) + formatVal(a.expected)
      );
      console.log(pc.dim(`      actual:   `) + formatVal(a.actual));
    }
  }

  if (!result.ok && !result.skipped && result.response) {
    const preview = previewBody(result.response.body);
    if (preview) console.log(pc.dim("    body: ") + pc.dim(preview));
  }

  if (Object.keys(result.extracted).length > 0) {
    const extracted = Object.entries(result.extracted)
      .map(([k, v]) => `${k}=${formatVal(v, 60)}`)
      .join(", ");
    console.log(pc.dim(`    extracted: ${extracted}`));
  }
}

export function printSummary(result: FlowResult) {
  const total = result.steps.length;
  const passed = result.steps.filter((s) => s.ok && !s.skipped).length;
  const failed = result.steps.filter((s) => !s.ok).length;
  const skipped = result.steps.filter((s) => s.skipped).length;

  console.log("");
  console.log(pc.bold(`Flow: ${result.name}`));
  console.log(
    `  ${pc.green(`${passed} passed`)} · ` +
      `${failed > 0 ? pc.red(`${failed} failed`) : pc.dim("0 failed")} · ` +
      `${pc.dim(`${skipped} skipped`)} · ${pc.dim(`${total} total`)} · ${pc.dim(`${result.durationMs}ms`)}`
  );
  console.log(
    result.ok
      ? pc.green(pc.bold("  ✓ Flow passed"))
      : pc.red(pc.bold("  ✗ Flow failed"))
  );
}

function previewBody(body: unknown): string {
  let s =
    typeof body === "string" ? body : JSON.stringify(body, null, 0);
  if (!s) return "";
  s = s.replace(/\n/g, " ");
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

function formatVal(v: unknown, max = 120): string {
  let s: string;
  try {
    s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (!s) s = String(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
}
