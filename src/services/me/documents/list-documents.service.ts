import * as meRepo from "../../../repositories/me.repo.js";
import type { DocumentsQuery } from "../../../schemas/me.schema.js";
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
  { type }: DocumentsQuery,
): Promise<StudentDocumentDto[]> => {
  const documents = await meRepo.listDocuments(userId, type);
  return documents.map(toDocumentDto);
};
