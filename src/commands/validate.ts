import pc from "picocolors";
import { loadFlow } from "../core/loader.js";

export function validateCommand(file: string): number {
  try {
    const { flow, path } = loadFlow(file);
    console.log(pc.green(`✓ Valid flow:`), pc.bold(flow.name));
    console.log(pc.dim(`  file: ${path}`));
    console.log(pc.dim(`  steps: ${flow.steps.length}`));
    return 0;
  } catch (e) {
    console.error(pc.red(e instanceof Error ? e.message : String(e)));
    return 1;
  }
}
