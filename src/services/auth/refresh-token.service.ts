import AppErr from "../../libs/appErr.js";
import authRepo from "../../repositories/index.js";
import { compareHash, createHash } from "../../utils/hash.js";
import { getTokenSignature, verifyToken } from "../../utils/token.js";
import { signTokens } from "./session.js";

export const refresh = async (refreshToken: string) => {
  const invalidToken = new AppErr("Invalid or expired token", 401);

  const { sid } = verifyToken(refreshToken, "refresh");
  if (typeof sid !== "string") throw invalidToken;

  const session = await authRepo.getSessionById(sid);
  if (!session) throw invalidToken;
  if (session.expiresAt < new Date()) {
    await authRepo.deleteSession(session.id);
    throw invalidToken;
  }

  const tokenMatch = await compareHash(
    getTokenSignature(refreshToken),
    session.refreshTokenHash,
  );
  if (!tokenMatch) {
    // A validly signed token for this session that isn't its current one was already
    // rotated out, so someone is replaying it: end the session for everyone holding it.
    await authRepo.deleteSession(session.id);
    throw invalidToken;
  }

  const user = await authRepo.getUserById(session.userId);
  if (!user) throw invalidToken;

  const tokens = signTokens(user, session.id);

  const newRefreshTokenHash = await createHash(
    getTokenSignature(tokens.refreshToken),
  );
  const rotated = await authRepo.updateToken(
    session.id,
    session.refreshTokenHash,
    newRefreshTokenHash,
  );
  if (!rotated) throw invalidToken;

  return tokens;
};
