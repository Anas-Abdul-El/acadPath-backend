import z from "zod";

/**
 * loginSchema validates the login request body.
 * Password: at least 8 characters with at least one number.
 */
export const loginSchema = z.object({
  email: z.email({
    error: "Invalid Email",
  }),
  password: z.string().regex(/^(?=.*\d).{8,}$/, {
    error: "Password must be at least 8 characters and contain a number",
  }),
});
/** LoginInput is the validated login body: { email, password }. */
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * signinSchema validates the sign-up request body.
 * Uses the same email and password rules as loginSchema, plus the user's profile fields.
 */
export const signinSchema = z.object({
  email: z.email({
    error: "Invalid Email",
  }),
  password: z.string().regex(/^(?=.*\d).{8,}$/, {
    error: "Password must be at least 8 characters and contain a number",
  }),
  name: z.string({
    error: "Name is required",
  }),
  yearOfStudy: z.string({
    error: "Year of Study is required",
  }),
});

/** SigninInput is the validated sign-up body: { email, password, name, yearOfStudy }. */
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

/**
 * logoutSchema validates the cookies sent to the logout route (parse req.cookies, not the body).
 * Same shape as refreshTokenSchema, since logout identifies the session by its refresh token.
 */
export const logoutSchema = z.object({
  refreshToken: z.jwt({
    error: "Invalid or missing refresh token",
  }),
});

/** LogoutInput is the validated logout cookie: { refreshToken }. */
export type LogoutInput = z.infer<typeof logoutSchema>;
