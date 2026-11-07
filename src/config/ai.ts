import { z } from "zod";

const aiEnv = z
  .object({
    OPENROUTER_KEY: z.string().min(1, "OPENROUTER_KEY is required"),
    OPENROUTER_MODEL: z
      .string()
      .min(1)
      .default("nvidia/nemotron-3-ultra-550b-a55b:free"),
  })
  .parse(process.env);

export const aiConfig = {
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: aiEnv.OPENROUTER_KEY,
  model: aiEnv.OPENROUTER_MODEL,
  timeoutMs: 60_000,
  maxRetries: 2,
} as const;
