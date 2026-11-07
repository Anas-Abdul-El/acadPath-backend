import AppErr from "../../libs/appErr.js";
import authRepo from "../../repositories/index.js";
import type { SigninInput } from "../../schemas/auth.schema.js";
import type { PublicUser } from "../../types/auth.dto.js";
import { createHash } from "../../utils/hash.js";
import { startSession } from "./session.js";

export const signIn = async (
  acc: SigninInput,
): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> => {
  const isUserExists = await authRepo.getUserByEmail(acc.email);
  if (isUserExists) throw new AppErr("Email is already registered", 409);

  let passwordHash: string;
  try {
    passwordHash = await createHash(acc.password);
  } catch {
    throw new AppErr("Failed to hash password", 500);
  }

  const user = await authRepo.createAccount({ ...acc, password: passwordHash });

  const tokens = await startSession(user);
  return { user, ...tokens };
};
