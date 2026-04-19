import type { HttpResponse } from "../types.js";

export interface HttpRequestInit {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  form?: Record<string, string>;
  timeoutMs?: number;
}

export async function sendRequest(
  req: HttpRequestInit
): Promise<HttpResponse> {
  const init: RequestInit = {
    method: req.method,
    headers: { ...req.headers },
  };

  if (req.form) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.form)) params.append(k, v);
    init.body = params.toString();
    (init.headers as Record<string, string>)["content-type"] =
      "application/x-www-form-urlencoded";
  } else if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      init.body = req.body;
    } else {
      init.body = JSON.stringify(req.body);
      if (!("content-type" in (init.headers as Record<string, string>))) {
        (init.headers as Record<string, string>)["content-type"] =
          "application/json";
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    req.timeoutMs ?? 30_000
  );
  init.signal = controller.signal;

  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(req.url, init);
  } finally {
    clearTimeout(timeout);
  }
  const durationMs = Date.now() - start;

  const rawBody = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  let body: unknown = rawBody;
  const contentType = headers["content-type"] ?? "";
  if (contentType.includes("application/json") && rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  } else if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    body,
    rawBody,
    durationMs,
    url: req.url,
    method: req.method,
  };
}

export function buildUrl(
  baseUrl: string | undefined,
  pathOrUrl: string,
  query?: Record<string, string | number | boolean>
): string {
  const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
  let url: URL;
  if (isAbsolute) {
    url = new URL(pathOrUrl);
  } else {
    if (!baseUrl) {
      throw new Error(
        `Step uses relative path "${pathOrUrl}" but no baseUrl is set.`
      );
    }
    const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    const rel = pathOrUrl.startsWith("/") ? pathOrUrl.slice(1) : pathOrUrl;
    url = new URL(rel, base);
  }
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.append(k, String(v));
    }
  }
  return url.toString();
}
