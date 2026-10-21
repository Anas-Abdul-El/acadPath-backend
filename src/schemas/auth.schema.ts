import { z } from "zod";
import { YearOfStudy } from "../generated/prisma/enums.js";

// Trim and lowercase before validating, so "Anas@Example.com " and "anas@example.com"
// are the same account.
const email = z.string().trim().toLowerCase().pipe(z.email("Invalid email address"));

// z.object() drops keys it doesn't list, so clients can't sneak in fields like `role`.
export const signInSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // bcrypt ignores everything after 72 bytes, so longer passwords would be silently cut.
    .refine((password) => Buffer.byteLength(password) <= 72, "Password is too long"),
  yearOfStudy: z.enum(YearOfStudy),
});

// Login only checks that a password was sent; the rules above apply when it is created.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
