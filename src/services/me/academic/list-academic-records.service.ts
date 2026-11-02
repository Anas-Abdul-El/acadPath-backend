import * as appRepo from "../../../repositories/app.repo.js";
import type { AcademicRecordsQuery } from "../../../schemas/app.schema.js";
import type { AcademicRecordDto } from "../../../types/app.dto.js";
import { termKey } from "../../shared/terms.js";

export const listAcademicRecords = async (
  userId: string,
  filters: AcademicRecordsQuery,
): Promise<AcademicRecordDto[]> => {
  const records = await appRepo.listAcademicRecords(userId, filters);
  return records.sort((a, b) => termKey(a) - termKey(b));
};
