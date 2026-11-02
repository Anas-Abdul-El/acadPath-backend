import AppErr from "../../libs/appErr.js";
import authRepo from "../../repositories/index.js";
import type { LoginInput } from "../../schemas/auth.schema.js";
import type { PublicUser } from "../../types/auth.dto.js";
import { compareHash, createHash } from "../../utils/hash.js";
import { startSession } from "./session.js";

const dummyHash = createHash("dummy-password-for-unknown-emails");

export const login = async (
  acc: LoginInput,
): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> => {
  const user = await authRepo.getUserByEmail(acc.email);

  const passwordMatch = await compareHash(
    acc.password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !passwordMatch) throw new AppErr("wrong email or password", 401);

  const { passwordHash: _, ...publicUser } = user;
  const tokens = await startSession(publicUser);
  return { user: publicUser, ...tokens };
};
