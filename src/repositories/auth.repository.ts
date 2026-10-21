import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";
import type {
  AuthUserDto,
  NewSession,
  NewStudent,
  SessionRecord,
  UserWithPassword,
} from "../types/auth.types.js";

// The columns we read for a user; passwordHash is only added where login needs it.
const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  studentProfile: { select: { yearOfStudy: true } },
} satisfies Prisma.UserSelect;

type AuthUserRow = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

function toAuthUser(row: AuthUserRow): AuthUserDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    yearOfStudy: row.studentProfile?.yearOfStudy ?? null,
  };
}

// Creates the user and their StudentProfile in one statement (Prisma wraps nested
// creates in a transaction). Returns null if the email is already taken.
export async function createStudent(data: NewStudent): Promise<AuthUserDto | null> {
  try {
    const row = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        studentProfile: { create: { yearOfStudy: data.yearOfStudy } },
      },
      select: authUserSelect,
    });
    return toAuthUser(row);
  } catch (error) {
    // P2002 = unique constraint violation; email is the only unique field we set.
    // Relying on the constraint (instead of checking first) also covers two
    // sign-ins with the same email arriving at the same time.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const row = await prisma.user.findUnique({
    where: { email },
    select: { ...authUserSelect, passwordHash: true },
  });
  if (!row) return null;
  return { user: toAuthUser(row), passwordHash: row.passwordHash };
}

export async function createSession(data: NewSession): Promise<void> {
  await prisma.session.create({ data });
}

export async function findSessionById(id: string): Promise<SessionRecord | null> {
  const row = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      refreshTokenHash: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { role: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    userRole: row.user.role,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

// Revokes the old session and creates its replacement together. Returns false if the
// old session was already revoked, e.g. a second refresh request with the same token
// got here first; then nothing is created.
export async function rotateSession(oldSessionId: string, newSession: NewSession): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // The `revokedAt: null` condition makes this safe under concurrency: Postgres lets
    // only one transaction flip it, and the other sees count 0.
    const { count } = await tx.session.updateMany({
      where: { id: oldSessionId, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now },
    });
    if (count === 0) return false;

    await tx.session.create({ data: newSession });
    return true;
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}