import { authConfig } from "../config/auth.js";
import type { User } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type { SigninInput } from "../schemas/auth.schema.js";
import type { PublicUser } from "../types/auth.dto.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export const getUserByEmail = async (email: string) => {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { ...publicUserSelect, passwordHash: true },
  });
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
    select: publicUserSelect,
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

export const getSessionById = async (id: string) => {
  return prisma.session.findUnique({
    where: { id },
  });
};

export const deleteSession = async (id: string) => {
  // deleteMany doesn't throw when the session is already gone (e.g. a double logout).
  await prisma.session.deleteMany({
    where: { id },
  });
};

// Only swaps the hash if it is still the one the caller checked, so two refreshes racing
// with the same token can't both succeed. Returns false when the other one won.
export const updateToken = async (
  id: string,
  oldRefreshTokenHash: string,
  newRefreshTokenHash: string,
): Promise<boolean> => {
  const { count } = await prisma.session.updateMany({
    where: { id, refreshTokenHash: oldRefreshTokenHash },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlMs),
    },
  });
  return count === 1;
};

export const getUserById = async (id: string): Promise<PublicUser | null> => {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
};
