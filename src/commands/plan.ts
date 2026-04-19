import pc from "picocolors";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import YAML from "yaml";
import { FlowSchema } from "../schema.js";
import { completeToYaml, detectLlmConfig } from "../llm/provider.js";

export interface PlanOptions {
  out?: string;
  input?: string;
}

export async function planCommand(
  description: string | undefined,
  opts: PlanOptions
): Promise<number> {
  let prompt = description ?? "";
  if (opts.input) {
    if (!existsSync(opts.input)) {
      console.error(pc.red(`File not found: ${opts.input}`));
      return 1;
    }
    prompt = readFileSync(opts.input, "utf8");
  }
  if (!prompt.trim()) {
    console.error(
      pc.red(
        'Provide a description as an argument or via --input <file>. Example:\n  curlflow plan "Login as admin, create a post, fetch it back"'
      )
    );
    return 1;
  }

  const cfg = detectLlmConfig();
  if (!cfg) {
    console.error(
      pc.red(
        "No LLM API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.\n" +
          "Tip: ask Cursor to write the YAML directly — it already knows the schema (see AGENTS.md)."
      )
    );
    return 1;
  }

  console.log(
    pc.dim(`Using ${cfg.provider} (${cfg.model})…`)
  );
  const yaml = await completeToYaml(cfg, prompt);

  let parsed: unknown;
  try {
    parsed = YAML.parse(yaml);
  } catch (e) {
    console.error(pc.red("LLM returned invalid YAML:"));
    console.error(yaml);
    return 1;
  }

  const check = FlowSchema.safeParse(parsed);
  if (!check.success) {
    console.error(pc.yellow("Warning: output did not fully match schema:"));
    for (const i of check.error.issues)
      console.error(pc.yellow(`  - ${i.path.join(".")}: ${i.message}`));
  }

  if (opts.out) {
    writeFileSync(opts.out, yaml.endsWith("\n") ? yaml : yaml + "\n");
    console.log(pc.green(`✓ Wrote ${opts.out}`));
  } else {
    console.log(yaml);
  }
  return 0;
}
