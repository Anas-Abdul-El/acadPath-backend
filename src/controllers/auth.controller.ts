import type { Request, Response, NextFunction } from "express";
import type { LoginInput, SigninInput } from "../schemas/auth.schema.js";
import authService from "../services/index.js";
import { generateToken } from "../utils/token.js";
import AppErr from "../libs/appErr.js";
import { authConfig } from "../config/auth.js";
import type { LoginOutput, SigninOutput } from "../types/auth.dto.js";
import { createHash } from "../utils/hash.js";
import authRepo from "../repositories/index.js";

export const signIn = async (
  req: Request<{}, {}, SigninInput, {}>,
  res: Response<SigninOutput>,
  next: NextFunction,
) => {
  const user = await authService.signIn(req.body);

  const refreshToken: string = generateToken(
    { sub: user.id, role: user.role },
    "refresh",
  );

  const accessToken: string = generateToken(
    { sub: user.id, role: user.role },
    "access",
  );

  const refreshTokenHash = await createHash(refreshToken);

  await authRepo.createSession(user.id, refreshTokenHash);

  res.cookie(authConfig.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: authConfig.refreshCookiePath,
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

  const refreshToken: string = generateToken(
    { sub: user.id, role: user.role },
    "refresh",
  );

  const accessToken: string = generateToken(
    { sub: user.id, role: user.role },
    "access",
  );

  const refreshTokenHash = await createHash(refreshToken);

  await authRepo.createSession(user.id, refreshTokenHash);
  res.cookie(authConfig.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: authConfig.refreshCookiePath,
    maxAge: authConfig.refreshTokenTtlMs,
  });

  res.send({
    data: {
      user,
      accessToken,
    },
  });
};
