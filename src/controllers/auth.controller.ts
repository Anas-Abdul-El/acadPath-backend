import type { CookieOptions, Request, Response } from "express";
import { authConfig } from "../config/auth.js";
import * as authService from "../services/auth.service.js";
import type { LoginDto, SignInDto } from "../types/auth.types.js";

// httpOnly: page JavaScript can't read the cookie, so an XSS bug can't steal it.
// sameSite "strict": the browser won't attach it to requests started by other sites.
// secure: HTTPS only in production (local dev runs on plain http).
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: authConfig.refreshCookiePath,
  maxAge: authConfig.refreshTokenTtlMs,
};

// Controllers only translate between HTTP and the service. req.body has already been
// validated (and normalized) by the validateBody middleware on the route.

export async function signIn(req: Request<Record<string, string>, unknown, SignInDto>, res: Response) {
  const { user, accessToken, refreshToken } = await authService.signIn(req.body);

  res.cookie(authConfig.refreshCookieName, refreshToken, refreshCookieOptions);
  res.status(201).json({ data: { user, accessToken } });
}

export async function login(req: Request<Record<string, string>, unknown, LoginDto>, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);

  res.cookie(authConfig.refreshCookieName, refreshToken, refreshCookieOptions);
  res.status(200).json({ data: { user, accessToken } });
}

export async function refresh(req: Request, res: Response) {
  // req.cookies comes from cookie-parser and is untyped, so check it is a string.
  const cookie: unknown = req.cookies[authConfig.refreshCookieName];
  const { accessToken, refreshToken } = await authService.refresh(
    typeof cookie === "string" ? cookie : undefined,
  );

  res.cookie(authConfig.refreshCookieName, refreshToken, refreshCookieOptions);
  res.status(200).json({ data: { accessToken } });
}
