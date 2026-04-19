import pc from "picocolors";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadFlow } from "../core/loader.js";
import { executeFlow } from "../core/executor.js";
import {
  printStepStart,
  printStepEnd,
  printSummary,
} from "../reporters/pretty.js";
import { toCursorJSON } from "../reporters/json.js";

export interface RunOptions {
  envFile?: string;
  baseUrl?: string;
  json?: boolean;
  out?: string;
  continueOnFail?: boolean;
  verbose?: boolean;
  strict?: boolean;
}

export async function runCommand(
  file: string,
  opts: RunOptions
): Promise<number> {
  const { flow, envVars, path } = loadFlow(file, opts.envFile);
  if (opts.baseUrl) flow.baseUrl = opts.baseUrl;

  if (!opts.json) {
    console.log(pc.bold(pc.cyan(`▶ ${flow.name}`)));
    if (flow.description) console.log(pc.dim(`  ${flow.description}`));
    console.log(pc.dim(`  file: ${path}`));
    if (flow.baseUrl) console.log(pc.dim(`  baseUrl: ${flow.baseUrl}`));
    console.log("");
  }

  const result = await executeFlow(flow, {
    env: envVars,
    stopOnFail: !opts.continueOnFail,
    strict: opts.strict,
    onStepStart: opts.json
      ? undefined
      : (step, i) => printStepStart(step.name, i, step.method),
    onStepEnd: opts.json ? undefined : (r) => printStepEnd(r),
  });

  if (opts.json) {
    const payload = toCursorJSON(result, !!opts.verbose);
    const out = JSON.stringify(payload, null, 2);
    if (opts.out) writeReport(opts.out, out);
    else console.log(out);
  } else {
    printSummary(result);
    if (opts.out) {
      writeReport(
        opts.out,
        JSON.stringify(toCursorJSON(result, !!opts.verbose), null, 2)
      );
      console.log(pc.dim(`  report: ${opts.out}`));
    }
  }

  return result.ok ? 0 : 1;
}

function writeReport(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
