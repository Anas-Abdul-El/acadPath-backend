import { authConfig } from "../config/auth.js";
import { YearOfStudy, type User } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type { SigninInput } from "../schemas/auth.schema.js";

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const user = prisma.user.findUnique({
    where: { email },
  });

  return { ...user, passwordHash: null };
};

export const createAccount = async (account: SigninInput): Promise<User> => {
  return prisma.user.create({
    data: {
      email: account.email,
      passwordHash: account.password,
      role: account.role,
      name: account.name,
    },
  });
};

export const createSession = async (
  userId: User["id"],
  refreshTokenHash: string,
) => {
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlMs),
    },
  });
};
