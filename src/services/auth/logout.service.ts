import authRepo from "../../repositories/index.js";
import { compareHash } from "../../utils/hash.js";
import { getTokenSignature, verifyToken } from "../../utils/token.js";

export const logout = async (refreshToken: string) => {
  let sessionId: unknown;
  try {
    sessionId = verifyToken(refreshToken, "refresh").sid;
  } catch {
    return;
  }
  if (typeof sessionId !== "string") return;

  const session = await authRepo.getSessionById(sessionId);
  if (!session) return;

  const tokenMatch = await compareHash(
    getTokenSignature(refreshToken),
    session.refreshTokenHash,
  );
  if (tokenMatch) await authRepo.deleteSession(session.id);
};
