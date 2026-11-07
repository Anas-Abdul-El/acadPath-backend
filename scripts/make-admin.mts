/**
 * Promotes an existing account to ADMIN, or lists the admins.
 * Sign-up only creates students, so this is the only way to make an admin.
 *
 *   pnpm make-admin you@example.com   promote that account
 *   pnpm make-admin                   list the current admins
 */
import { UserRole } from "../src/generated/prisma/client.js";
import { prisma } from "../src/libs/prisma.js";

const email = process.argv[2]?.trim();

try {
  if (!email) {
    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { email: true, name: true, createdAt: true, isDeleted: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admins.length) console.log("No admins yet.");
    for (const admin of admins)
      console.log(
        `${admin.email}  ${admin.name}  created ${admin.createdAt.toISOString()}${admin.isDeleted ? "  (deleted)" : ""}`,
      );
  } else {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      console.error(`No account with the email ${email}. Sign up first.`);
      process.exitCode = 1;
    } else if (user.role === UserRole.ADMIN) {
      console.log(`${user.email} is already an admin.`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN },
      });
      console.log(
        `${user.email} is now an admin. Log in again to get an admin token.`,
      );
    }
  }
} finally {
  await prisma.$disconnect();
}
