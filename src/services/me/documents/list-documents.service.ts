import * as meRepo from "../../../repositories/me.repo.js";
import type { StudentDocumentDto } from "../../../types/me.dto.js";

export const toDocumentDto = (
  document: Awaited<ReturnType<typeof meRepo.listDocuments>>[number],
): StudentDocumentDto => ({
  ...document,
  processedAt: document.processedAt?.toISOString() ?? null,
  createdAt: document.createdAt.toISOString(),
});

export const listDocuments = async (
  userId: string,
): Promise<StudentDocumentDto[]> => {
  const documents = await meRepo.listDocuments(userId);
  return documents.map(toDocumentDto);
};
