/**
 * Minimal LLM client. Supports OpenAI or Anthropic, chosen by env vars.
 * Exits with a helpful message if no key is configured.
 */

const SYSTEM_PROMPT = `You convert natural-language descriptions of backend feature flows into curlflow YAML.

Output RULES:
- Reply with ONLY a fenced \`\`\`yaml block, no prose.
- Use the documented curlflow schema (fields: name, description, baseUrl, vars, headers, auth, steps[]).
- Each step has: name, method, path (or url), headers?, body?, expect?, extract?.
- Use \${var} interpolation for values produced by prior steps.
- Use \${env.NAME} for secrets / base URLs.
- For any id/token created in step N that step N+1 needs, include an \`extract:\` block.
- Prefer \`expect.body.jsonPath\` for key fields with { exists: true } rather than strict equality on full responses.
- Status: assume 200/201 for success, use an array [200, 201, 204] when ambiguous.
- Do NOT invent endpoints the user didn't mention; use sensible RESTful paths based on the description.`;

export interface LlmConfig {
  provider: "openai" | "anthropic";
  apiKey: string;
  model: string;
}

export function detectLlmConfig(): LlmConfig | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.CURLFLOW_MODEL ?? "gpt-4o-mini",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CURLFLOW_MODEL ?? "claude-3-5-sonnet-latest",
    };
  }
  return null;
}

export async function completeToYaml(
  cfg: LlmConfig,
  userPrompt: string
): Promise<string> {
  if (cfg.provider === "openai") return openaiCall(cfg, userPrompt);
  return anthropicCall(cfg, userPrompt);
}

async function openaiCall(
  cfg: LlmConfig,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return extractYaml(data.choices[0]?.message?.content ?? "");
}

async function anthropicCall(
  cfg: LlmConfig,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text: string }[];
  };
  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  return extractYaml(text);
}

function extractYaml(text: string): string {
  const match = text.match(/```ya?ml\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  return text.trim();
}
