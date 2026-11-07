import { randomUUID } from "node:crypto";
import authRepo from "../../repositories/index.js";
import type { PublicUser } from "../../types/auth.dto.js";
import { createHash } from "../../utils/hash.js";
import { generateToken, getTokenSignature } from "../../utils/token.js";

export const signTokens = (user: PublicUser, sessionId: string) => {
  // jti makes every refresh token unique, even two issued in the same second.
  const refreshToken = generateToken(
    { sub: user.id, role: user.role, sid: sessionId, jti: randomUUID() },
    "refresh",
  );
  const accessToken = generateToken(
    { sub: user.id, role: user.role },
    "access",
  );

  return { accessToken, refreshToken };
};

export const startSession = async (user: PublicUser) => {
  const sessionId = randomUUID();

  const { accessToken, refreshToken } = signTokens(user, sessionId);

  const refreshTokenHash = await createHash(getTokenSignature(refreshToken));
  await authRepo.createSession(sessionId, user.id, refreshTokenHash);

  return { accessToken, refreshToken };
};
