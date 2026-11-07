import z from "zod";

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Invalid Email" }));

/**
 * loginSchema validates the login request body. Only presence is checked, so a
 * wrong password is always a 401; the strength rules belong to sign-up.
 */
export const loginSchema = z.object({
  email,
  password: z
    .string({ error: "Password is required" })
    .min(1, { error: "Password is required" }),
});
/** LoginInput is the validated login body: { email, password }. */
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * signinSchema validates the sign-up request body.
 * Email is trimmed and lowercased like loginSchema. Password: 8+ characters with a
 * number, at most 72 bytes (bcrypt ignores anything past that). Name is trimmed, non-empty.
 * There is no role: every account created here is a student, and a role sent by the
 * client is dropped. Admins are promoted with scripts/make-admin.mts.
 */
export const signinSchema = z.object({
  email,
  password: z
    .string({ error: "Password is required" })
    .regex(/^(?=.*\d).{8,}$/, {
      error: "Password must be at least 8 characters and contain a number",
    })
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
      error: "Password is too long",
    }),
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, { error: "Name is required" }),
});

/** SigninInput is the validated sign-up body: { email, password, name }. */
export type SigninInput = z.infer<typeof signinSchema>;

/**
 * refreshTokenSchema validates the cookies sent to the refresh route (parse req.cookies, not the body).
 * It only checks the token is shaped like a JWT; verifyToken still has to check its signature and expiry.
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.jwt({
    error: "Invalid or missing refresh token",
  }),
});

/** RefreshTokenInput is the validated refresh cookie: { refreshToken }. */
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
