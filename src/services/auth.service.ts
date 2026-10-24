import { randomUUID } from "node:crypto";
import AppErr from "../libs/appErr.js";
import authRepo from "../repositories/index.js";
import type { LoginInput, SigninInput } from "../schemas/auth.schema.js";
import type { PublicUser } from "../types/auth.dto.js";
import { createHash, compareHash } from "../utils/hash.js";
import { generateToken, getTokenSignature } from "../utils/token.js";

export const signIn = async (acc: SigninInput): Promise<PublicUser> => {
  const isUserExists = await authRepo.getUserByEmail(acc.email);
  if (isUserExists) throw new AppErr("Email already exists", 400);

  let passwordHash: string;
  try {
    passwordHash = await createHash(acc.password);
  } catch {
    throw new AppErr("Failed to hash password", 500);
  }

  const user = await authRepo.createAccount({ ...acc, password: passwordHash });

  return user;
};

// Compared against when the email is unknown (see login). Hashed once, at the same
// cost as real passwords, so both paths take the same time.
const dummyHash = createHash("dummy-password-for-unknown-emails");

export const login = async (acc: LoginInput): Promise<PublicUser> => {
  const user = await authRepo.getUserByEmail(acc.email);

  // Always run one bcrypt compare and fail with the same status, so neither the
  // response time nor the status code reveals whether the email is registered.
  const passwordMatch = await compareHash(
    acc.password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !passwordMatch)
    throw new AppErr("wrong email or password", 401);

  // The user is sent back to the client, so the hash must not go with it.
  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
};

// The refresh token carries its session's id (sid), so logout and refresh can find the
// session and bcrypt-compare the token against it.
export const startSession = async (user: PublicUser) => {
  const sessionId = randomUUID();

  const refreshToken = generateToken(
    { sub: user.id, role: user.role, sid: sessionId },
    "refresh",
  );
  const accessToken = generateToken({ sub: user.id, role: user.role }, "access");

  const refreshTokenHash = await createHash(getTokenSignature(refreshToken));
  await authRepo.createSession(sessionId, user.id, refreshTokenHash);

  return { accessToken, refreshToken };
};
