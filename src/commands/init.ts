import pc from "picocolors";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const EXAMPLE_FLOW = `# curlflow flow definition. Run with: curlflow run flows/example.flow.yaml
name: Example auth flow
description: Login, fetch profile, update, verify
baseUrl: \${env.BASE_URL}

vars:
  email: demo@example.com
  password: secret123

steps:
  - name: Login
    method: POST
    path: /auth/login
    body:
      email: \${email}
      password: \${password}
    expect:
      status: 200
      body:
        jsonPath:
          $.token: { exists: true }
    extract:
      token: $.token
      userId: $.user.id

  - name: Get profile
    method: GET
    path: /users/\${userId}
    headers:
      Authorization: Bearer \${token}
    expect:
      status: 200
      body:
        jsonPath:
          $.email: \${email}

  - name: Update name
    method: PATCH
    path: /users/\${userId}
    headers:
      Authorization: Bearer \${token}
    body:
      name: Updated Name
    expect:
      status: [200, 204]

  - name: Verify update
    method: GET
    path: /users/\${userId}
    headers:
      Authorization: Bearer \${token}
    expect:
      status: 200
      body:
        jsonPath:
          $.name: Updated Name
`;

const EXAMPLE_ENV = `BASE_URL=http://localhost:3000
`;

const AGENTS_MD = `# curlflow · agent guide

You (the AI) can test backend features by writing and running **curlflow** flow files.

## Workflow

1. When the user describes a feature flow, write a YAML file under \`flows/\`.
2. Run it: \`curlflow run flows/<name>.flow.yaml --json --out .curlflow/last.json\`
3. Read \`.curlflow/last.json\`. Each \`steps[].failedAssertions\` tells you exactly what broke.
4. Fix the backend code, re-run, iterate.

## Flow file format (YAML)

\`\`\`yaml
name: <human readable>
baseUrl: \${env.BASE_URL}        # or hardcoded
vars:                           # any pre-defined vars, usable as \${name}
  email: demo@example.com
steps:
  - name: <what this step does>
    method: POST
    path: /auth/login           # joined with baseUrl
    headers:                    # optional
      X-Tenant: acme
    body:                       # JSON object, stringified automatically
      email: \${email}
      password: secret
    expect:                     # optional assertions
      status: 200               # number or [200, 201]
      headers:
        content-type: application/json
      body:
        jsonPath:
          $.token: { exists: true }
          $.user.role: admin
    extract:                    # save values into vars for later steps
      token: $.token
      userId: $.user.id
    skipIf: "!token"           # optional condition
    retries: 2                  # optional
\`\`\`

## Variable interpolation

- \`\${name}\` — references a var (from \`vars:\` or previous \`extract:\`)
- \`\${env.NAME}\` — references an environment variable / .env entry
- Dotted paths work: \`\${user.profile.email}\`

## Assertion shorthands under \`jsonPath\`

- \`{ exists: true }\` / \`{ exists: false }\`
- \`{ type: "string" | "number" | "boolean" | "object" | "array" | "null" }\`
- \`{ regex: "^[a-z]+$" }\`
- \`{ equals: <value> }\`
- \`{ contains: <subset> }\`
- A plain value does deep equality.

## Tips

- Always add \`extract\` for any value later steps need (ids, tokens).
- Prefer \`expect.body.jsonPath\` over full-body equality — backend fields drift.
- Use \`--continue-on-fail\` while debugging to see all failures at once.
- \`curlflow validate <file>\` checks the schema without hitting the network.
`;

const README_NOTE = `# flows/

Define reusable backend feature flows here as \`<name>.flow.yaml\`.
Run one with:

\`\`\`bash
curlflow run flows/example.flow.yaml
\`\`\`

See \`AGENTS.md\` at the project root for the full format.
`;

export function initCommand(dir = ".") {
  const root = resolve(dir);
  const flowsDir = join(root, "flows");
  const curlflowDir = join(root, ".curlflow");

  if (!existsSync(flowsDir)) mkdirSync(flowsDir, { recursive: true });
  if (!existsSync(curlflowDir)) mkdirSync(curlflowDir, { recursive: true });

  writeFile(join(flowsDir, "example.flow.yaml"), EXAMPLE_FLOW);
  writeFile(join(flowsDir, "README.md"), README_NOTE);
  writeFile(join(root, ".env.example"), EXAMPLE_ENV);
  writeFile(join(root, "AGENTS.md"), AGENTS_MD);

  console.log(pc.green("✓ Initialized curlflow project"));
  console.log(pc.dim("  flows/example.flow.yaml"));
  console.log(pc.dim("  AGENTS.md"));
  console.log(pc.dim("  .env.example"));
  console.log("");
  console.log("Next:");
  console.log(pc.cyan(`  curlflow run flows/example.flow.yaml`));
  return 0;
}

function writeFile(path: string, contents: string) {
  if (existsSync(path)) {
    console.log(pc.yellow(`  skipped (exists): ${path}`));
    return;
  }
  writeFileSync(path, contents);
}
