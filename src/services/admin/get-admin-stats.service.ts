import * as adminRepo from "../../repositories/admin.repo.js";
import type { AdminStatsQuery } from "../../schemas/admin.schema.js";
import type { AdminStatsDto } from "../../types/admin.dto.js";
import { getCatalogStatus, getSourceStatus } from "../me/index.js";

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/**
 * Builds the admin dashboard for GET /admin/stats: catalog counts, student
 * sign-ups per month (UTC, oldest first, the last `months` months including the
 * current one, zero-filled), and how many universities and sources are in each status.
 */
export const getAdminStats = async ({
  months,
}: AdminStatsQuery): Promise<AdminStatsDto> => {
  const now = new Date();
  const since = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const [counts, signups, universities] = await Promise.all([
    adminRepo.countCatalog(),
    adminRepo.listStudentSignupsSince(since),
    adminRepo.listUniversitySourceStates(),
  ]);

  const byMonth = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const month = new Date(
      Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1),
    );
    byMonth.set(monthKey(month), 0);
  }
  for (const { createdAt } of signups) {
    const key = monthKey(createdAt);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  const universitiesByCatalogStatus = { AVAILABLE: 0, PROCESSING: 0, UNAVAILABLE: 0 };
  const sourcesByStatus = { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  for (const { sources } of universities) {
    universitiesByCatalogStatus[getCatalogStatus(sources)]++;
    for (const source of sources) sourcesByStatus[getSourceStatus(source)]++;
  }

  return {
    counts,
    registrationsByMonth: [...byMonth].map(([month, count]) => ({ month, count })),
    universitiesByCatalogStatus,
    sourcesByStatus,
  };
};
