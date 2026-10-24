import { authConfig } from "../config/auth.js";
import { YearOfStudy, type User } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type { SigninInput } from "../schemas/auth.schema.js";
import type { PublicUser } from "../types/auth.dto.js";

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  return user;
};

export const createAccount = async (
  account: SigninInput,
): Promise<PublicUser> => {
  return prisma.user.create({
    data: {
      email: account.email,
      passwordHash: account.password,
      role: account.role,
      name: account.name,
    },
    omit: { passwordHash: true },
  });
};

export const createSession = async (
  id: string,
  userId: User["id"],
  refreshTokenHash: string,
) => {
  await prisma.session.create({
    data: {
      id,
      userId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlMs),
    },
  });
};
