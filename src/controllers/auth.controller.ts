import type { Request, Response, NextFunction, CookieOptions } from "express";
import type {
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  SigninInput,
} from "../schemas/auth.schema.js";
import authService from "../services/index.js";
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
  const user = await authService.signIn(req.body);

  const { accessToken, refreshToken } = await authService.startSession(user);

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
  const user = await authService.login(req.body);

  const { accessToken, refreshToken } = await authService.startSession(user);

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
    await authService.refresh(oldRefreshToken);

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

  await authService.logout(refreshToken);

  res.clearCookie(authConfig.refreshCookieName, refreshCookieOptions);
  res.sendStatus(204);
};
