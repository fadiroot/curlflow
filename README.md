# curlflow

**curlflow** is a Node.js CLI for running **backend API feature flows** as repeatable, file-based tests. You describe a sequence of HTTP calls in YAML (or JSON): methods, paths, bodies, auth, and what you expect back. The tool runs each step, resolves variables from earlier responses, asserts status and JSON, and can emit a **JSON report** for humans, CI, or tools like Cursor.

Think of it as **versioned curl scripts with variables and assertions**—useful after each feature or before a release to prove the same user journey still works.

---

## Project overview

| Area | What it is |
|------|------------|
| **Purpose** | Encode multi-step API flows (login → create → read → …) once, run them anytime against your running server or a deployed URL. |
| **Input** | Flow files: `*.flow.yaml` or `*.json` with a small schema (name, `baseUrl`, optional `vars` / `auth`, `steps[]`). |
| **Runtime** | Node **20+**, uses native `fetch`. No browser. |
| **Output** | Colored terminal summary, or `--json` (optionally `--out path`) for machine-readable pass/fail and failed assertions. |
| **Optional AI** | `curlflow plan` can draft YAML from natural language if `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set; you can also author flows by hand or with Cursor using `AGENTS.md`. |

Repository layout (high level):

- `src/cli.ts` — CLI entry
- `src/schema.ts` — flow schema (Zod)
- `src/core/` — load YAML/JSON, interpolate `${var}` / `${env.NAME}`, HTTP, JSONPath extract, assertions, executor
- `src/commands/` — `run`, `init`, `validate`, `plan`
- `src/reporters/` — pretty console + Cursor-oriented JSON
- `examples/` — sample flows and a tiny local server for smoke tests

---

## How developers use it (backend project workflow)

### 1. Install the CLI

From **this** repo (the curlflow tool itself):

```bash
npm install
npm run build
npm link          # optional: global `curlflow` command
```

Alternatively run without linking:

```bash
npx tsx src/cli.ts --help
```

### 2. Add flows to **your** API repository

In the **backend** project where your HTTP server lives:

```bash
cd /path/to/your-api
curlflow init
```

This creates:

- `flows/` — put your feature flows here (e.g. `flows/auth.signup.flow.yaml`)
- `AGENTS.md` — conventions and schema hints for Cursor (safe to commit)
- `.env.example` — document `BASE_URL` and any `${env.*}` keys you use
- `.curlflow/` — empty dir; a good place for `--out .curlflow/last.json` reports (add to `.gitignore` if you do not want reports committed)

Create a local `.env` (do **not** commit secrets):

```env
BASE_URL=http://localhost:3000
```

Use in flows:

```yaml
baseUrl: ${env.BASE_URL}
```

Start your API as you normally do, then run flows against it.

### 3. Write or generate a flow

- **By hand / in the editor:** follow the example under [Flow format](#flow-format-abridged) and the generated `AGENTS.md`.
- **With Cursor:** ask it to add or update `flows/<feature>.flow.yaml` using `AGENTS.md`.
- **With `plan`:** `curlflow plan "describe the journey" -o flows/foo.flow.yaml` (requires an LLM API key).

Validate without calling the network:

```bash
curlflow validate flows/foo.flow.yaml
```

### 4. Run flows during development

```bash
curlflow run flows/foo.flow.yaml
```

For tooling or AI-assisted debugging:

```bash
curlflow run flows/foo.flow.yaml --json --out .curlflow/last.json
```

Non-zero exit code means at least one step failed or the file was invalid.

### 5. Optional: CI

Install/build curlflow (or use `npm link` / a published package), set `BASE_URL` (and secrets) as CI secrets, start your app or point at a preview URL, then:

```bash
curlflow run flows/**/*.flow.yaml --json
```

Use a glob your shell supports, or list files explicitly.

---

## Quick start (from this repo)

```bash
npm install
npm run build

# Scaffold a new project (run from any directory)
node dist/cli.js init /tmp/my-api-test

# Run the bundled httpbin example (needs outbound HTTPS)
node dist/cli.js run examples/httpbin.flow.yaml
```

**Reliable local smoke test** (no public internet): in one terminal start the tiny demo server, in another run the flow:

```bash
# Terminal A
node examples/local-server.mjs

# Terminal B
node dist/cli.js run examples/local.flow.yaml
```

---

## Flow format (abridged)

```yaml
name: Login + create post
baseUrl: ${env.BASE_URL}

vars:
  email: demo@example.com

steps:
  - name: Login
    method: POST
    path: /auth/login
    body:
      email: ${email}
      password: secret
    expect:
      status: 200
    extract:
      token: $.token
      userId: $.user.id

  - name: Create post
    method: POST
    path: /posts
    headers:
      Authorization: Bearer ${token}
    body:
      title: Hello
      authorId: ${userId}
    expect:
      status: 201
      body:
        jsonPath:
          $.id: { exists: true }
    extract:
      postId: $.id

  - name: Fetch post back
    method: GET
    path: /posts/${postId}
    headers:
      Authorization: Bearer ${token}
    expect:
      status: 200
      body:
        jsonPath:
          $.title: Hello
          $.authorId: ${userId}
```

### Features

- **`${var}` interpolation** across URLs, headers, query, body, and assertion values.
- **`${env.NAME}`** for `.env` / `.env.local` / process environment.
- **`extract`** — JSONPath values from responses into vars for later steps.
- **Assertions** — status (single or list), header substrings, body equals / subset contains, JSONPath rules (`exists`, `type`, `regex`, `equals`, `contains`).
- **`auth`** — `bearer`, `basic`, or custom `header` applied to all steps.
- **`retries`**, **`timeoutMs`**, **`skipIf`** on steps.

---

## Commands

| Command | Purpose |
|---------|---------|
| `curlflow init [dir]` | Scaffold `flows/`, `AGENTS.md`, `.env.example`, `.curlflow/` |
| `curlflow run <file>` | Execute a flow. Flags: `--json`, `--out`, `--env-file`, `--base-url`, `--continue-on-fail`, `--verbose`, `--strict` |
| `curlflow validate <file>` | Schema-check only (no network) |
| `curlflow plan "<desc>"` | Natural language → YAML (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`; optional `CURLFLOW_MODEL`) |

Run `curlflow run --help` for all flags.

---

## Cursor and AI assistants

After `curlflow init` in your API repo, commit **`AGENTS.md`**. Typical loop:

1. You describe the feature path you want tested.
2. The assistant creates or updates `flows/<name>.flow.yaml`.
3. It runs: `curlflow run flows/<name>.flow.yaml --json --out .curlflow/last.json`.
4. It reads `failedAssertions` and response snippets from the JSON, then adjusts the backend or the flow.

---

## License

MIT
