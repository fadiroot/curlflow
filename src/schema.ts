import { z } from "zod";

export const AssertBodySchema = z
  .object({
    equals: z.unknown().optional(),
    contains: z.unknown().optional(),
    jsonPath: z.record(z.unknown()).optional(),
  })
  .strict();

export const AssertSchema = z
  .object({
    status: z.union([z.number(), z.array(z.number())]).optional(),
    headers: z.record(z.string()).optional(),
    body: AssertBodySchema.optional(),
  })
  .strict();

export const StepSchema = z
  .object({
    name: z.string(),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
      .default("GET"),
    path: z.string().optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.unknown().optional(),
    form: z.record(z.string()).optional(),
    timeoutMs: z.number().int().positive().optional(),
    expect: AssertSchema.optional(),
    extract: z.record(z.string()).optional(),
    skipIf: z.string().optional(),
    retries: z.number().int().min(0).max(10).optional(),
  })
  .strict()
  .refine((s) => !!(s.path || s.url), {
    message: "Step must define either `path` or `url`",
  });

export const FlowSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    baseUrl: z.string().optional(),
    env: z.record(z.string()).optional(),
    vars: z.record(z.unknown()).optional(),
    headers: z.record(z.string()).optional(),
    auth: z
      .object({
        type: z.enum(["bearer", "basic", "header"]).default("bearer"),
        token: z.string().optional(),
        header: z.string().optional(),
        value: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
    steps: z.array(StepSchema).min(1),
  })
  .strict();

export type Flow = z.infer<typeof FlowSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Assert = z.infer<typeof AssertSchema>;
