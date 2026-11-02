import type { Request, Response, NextFunction, CookieOptions } from "express";
import type {
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  SigninInput,
} from "../schemas/auth.schema.js";
import * as loginService from "../services/auth/login.service.js";
import * as logoutService from "../services/auth/logout.service.js";
import * as refreshTokenService from "../services/auth/refresh-token.service.js";
import * as signInService from "../services/auth/sign-in.service.js";
import { authConfig } from "../config/auth.js";
import type {
  LoginOutput,
  RefreshOutput,
  SigninOutput,
} from "../types/auth.dto.js";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: authConfig.refreshCookiePath,
};

export const signIn = async (
  req: Request<{}, {}, SigninInput, {}>,
  res: Response<SigninOutput>,
  next: NextFunction,
) => {
  const { user, accessToken, refreshToken } = await signInService.signIn(
    req.body,
  );

  res.cookie(authConfig.refreshCookieName, refreshToken, {
    ...refreshCookieOptions,
    maxAge: authConfig.refreshTokenTtlMs,
  });

  res.send({
    data: {
      user,
      accessToken,
    },
  });
};

export const login = async (
  req: Request<{}, {}, LoginInput, {}>,
  res: Response<LoginOutput>,
  next: NextFunction,
) => {
  const { user, accessToken, refreshToken } = await loginService.login(
    req.body,
  );

  res.cookie(authConfig.refreshCookieName, refreshToken, {
    ...refreshCookieOptions,
    maxAge: authConfig.refreshTokenTtlMs,
  });

  res.send({
    data: {
      user,
      accessToken,
    },
  });
};

export const refresh = async (req: Request, res: Response<RefreshOutput>) => {
  const { refreshToken: oldRefreshToken } = res.locals
    .cookies as RefreshTokenInput;

  const { user, accessToken, refreshToken } =
    await refreshTokenService.refresh(oldRefreshToken);

  res.cookie(authConfig.refreshCookieName, refreshToken, {
    ...refreshCookieOptions,
    maxAge: authConfig.refreshTokenTtlMs,
  });

  res.send({
    data: {
      user,
      accessToken,
    },
  });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = res.locals.cookies as LogoutInput;

  await logoutService.logout(refreshToken);

  res.clearCookie(authConfig.refreshCookieName, refreshCookieOptions);
  res.sendStatus(204);
};
