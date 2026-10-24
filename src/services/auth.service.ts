import type { User } from "../generated/prisma/client.js";
import AppErr from "../libs/appErr.js";
import authRepo from "../repositories/index.js";
import type { SigninInput } from "../schemas/auth.schema.js";
import { createHash } from "../utils/hash.js";

export const signIn = async (acc: SigninInput): Promise<User> => {
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
