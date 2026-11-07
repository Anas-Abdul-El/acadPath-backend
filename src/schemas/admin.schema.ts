import z from "zod";

/** adminStatsQuerySchema validates the GET /admin/stats query: months is 1–24 and defaults to 8. */
export const adminStatsQuerySchema = z.object({
  months: z.coerce
    .number({ error: "Months must be a number" })
    .int({ error: "Months must be a whole number" })
    .min(1, { error: "Months must be at least 1" })
    .max(24, { error: "Months must be at most 24" })
    .default(8),
});

/** AdminStatsQuery is the validated query: { months }. */
export type AdminStatsQuery = z.infer<typeof adminStatsQuerySchema>;
