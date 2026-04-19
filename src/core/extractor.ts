import { JSONPath } from "jsonpath-plus";

/** Extract a value from response body using JSONPath (e.g. $.data.id) or a shorthand dotted path. */
export function extract(body: unknown, expression: string): unknown {
  if (!expression) return undefined;

  const expr = expression.startsWith("$") ? expression : "$." + expression;
  const result = JSONPath({ path: expr, json: body as object, wrap: false });
  return result;
}
