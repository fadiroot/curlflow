import { readFileSync, existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import YAML from "yaml";
import dotenv from "dotenv";
import { FlowSchema, type Flow } from "../schema.js";

export interface LoadedFlow {
  flow: Flow;
  path: string;
  envVars: Record<string, string>;
}

export function loadFlow(filePath: string, envFile?: string): LoadedFlow {
  const absolute = resolve(filePath);
  if (!existsSync(absolute)) {
    throw new Error(`Flow file not found: ${absolute}`);
  }

  const raw = readFileSync(absolute, "utf8");
  const ext = extname(absolute).toLowerCase();
  const parsed = ext === ".json" ? JSON.parse(raw) : YAML.parse(raw);

  const result = FlowSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid flow file ${absolute}:\n${issues}`);
  }

  const envVars = loadEnv(envFile);
  return { flow: result.data, path: absolute, envVars };
}

export function loadEnv(envFile?: string): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;

  const candidates = envFile
    ? [envFile]
    : [".env.local", ".env"];

  for (const file of candidates) {
    const abs = resolve(file);
    if (existsSync(abs)) {
      const parsed = dotenv.parse(readFileSync(abs, "utf8"));
      Object.assign(env, parsed);
    }
  }
  return env;
}
