export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
  durationMs: number;
  url: string;
  method: string;
}

export interface AssertionResult {
  ok: boolean;
  field: string;
  expected?: unknown;
  actual?: unknown;
  message?: string;
}

export interface StepResult {
  name: string;
  index: number;
  ok: boolean;
  skipped: boolean;
  skipReason?: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response?: HttpResponse;
  assertions: AssertionResult[];
  extracted: Record<string, unknown>;
  error?: string;
}

export interface FlowResult {
  name: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: StepResult[];
  vars: Record<string, unknown>;
}
