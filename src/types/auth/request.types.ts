import type { z } from "zod";
import type { loginSchema, signInSchema } from "../../schemas/auth.schema.js";

// Inferred from the Zod schemas, so they can't drift apart.

export type SignInDto = z.infer<typeof signInSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
