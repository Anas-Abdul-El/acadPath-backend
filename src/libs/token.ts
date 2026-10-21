import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { authConfig } from "../config/auth.js";
import AppErr from "./appErr.js";

// The three kinds of token the API signs. Each kind is signed and verified with
// its own secret, so a refresh token can never be replayed as an access token.
export type TokenType = keyof typeof authConfig.tokens;

/**
 * generateToken signs a JWT of the given type, using that type's secret and lifetime.
 * @param payload - The claims to include in the token. Anyone can decode them, so never put secrets here.
 * @param type - The type of token to generate ("access", "refresh" or "verify").
 */
export const generateToken = (payload: object, type: TokenType): string => {
  const { secret, expiresIn } = authConfig.tokens[type];
  return jwt.sign(payload, secret, { expiresIn, algorithm: "HS256" });
};

/**
 * verifyToken verifies the provided JWT based on its type ("access", "refresh" or "verify").
 * @param token - The JWT to verify.
 * @param type - The type the token is expected to be.
 * @returns The decoded payload if the token is valid; otherwise, throws a 401 AppErr.
 */
export const verifyToken = (token: string, type: TokenType): JwtPayload => {
  const { secret } = authConfig.tokens[type];

  let payload: string | JwtPayload;
  try {
    // Pin the algorithm so the token can't choose how it gets checked.
    payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    throw new AppErr("Invalid or expired token", 401);
  }

  // We only ever sign objects, so a string payload isn't one of our tokens.
  if (typeof payload === "string") throw new AppErr("Invalid or expired token", 401);
  return payload;
};
