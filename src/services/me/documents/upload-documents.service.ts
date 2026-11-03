import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { type StudentDocumentType, SourceType } from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import { geminiMessage, parseAiJson } from "../../../libs/model.js";
import { TRANSCRIPT_EXTRACTION_PROMPT } from "../../../libs/prompt.js";
import { ASSETS_BUCKET, s3 } from "../../../libs/storage.js";
import * as meRepo from "../../../repositories/me.repo.js";
import {
  transcriptDataSchema,
  type TranscriptData,
  type UploadSourcesInput,
} from "../../../schemas/me.schema.js";
import type { StudentDocumentDto } from "../../../types/me.dto.js";
import { normalizeCode } from "../../shared/index.js";
import {
  parseUploadedPdf,
  type MajorInput,
  type UploadedFile,
  getSelection,
} from "../university/index.js";
import { toDocumentDto } from "./list-documents.service.js";

type StoredFile = UploadedFile & { key: string };

type MatchedRecord = Parameters<typeof meRepo.saveDocuments>[2][number];

const extractTranscriptFromFiles = async (
  input: MajorInput,
  files: UploadSourcesInput,
): Promise<TranscriptData> => {
  const documents: { fileName: string; text: string }[] = [];
  const attachments: { buffer: Buffer; mimeType: string }[] = [];

  for (const file of files) {
    if (file.sourceType === SourceType.PDF) {
      const { text } = await parseUploadedPdf(file);
      if (text.length > 0) {
        documents.push({ fileName: file.originalname, text });
        continue;
      }
    }
    attachments.push({ buffer: file.buffer, mimeType: file.mimetype });
  }

  const reply = await geminiMessage(
    TRANSCRIPT_EXTRACTION_PROMPT,
    JSON.stringify({
      universityName: input.name.trim(),
      majorName: input.major.trim(),
      documents,
    }),
    attachments,
  );

  const result = transcriptDataSchema.safeParse(parseAiJson(reply));
  if (!result.success)
    throw new AppErr("AI returned invalid transcript data", 502);

  return result.data;
};

const matchRecordsToMajorCourses = async (
  major: { id: string; name: string },
  records: TranscriptData["records"],
): Promise<MatchedRecord[]> => {
  const courses = await meRepo.listMajorCourses(major.id);
  const idByCode = new Map(
    courses.map((course) => [normalizeCode(course.code), course.id]),
  );

  const matched = new Map<string, MatchedRecord>();
  for (const record of records) {
    const courseId = idByCode.get(normalizeCode(record.code));
    if (!courseId) continue;

    matched.set(`${courseId}-${record.term}-${record.year}`, {
      courseId,
      status: record.status,
      grade: record.status === "IN_PROGRESS" ? null : record.grade,
      term: record.term,
      year: record.year,
    });
  }

  if (matched.size === 0)
    throw new AppErr(
      `None of the courses in the uploaded files are in ${major.name}`,
      422,
    );

  return [...matched.values()];
};

const extensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const storeFiles = async (
  studentId: string,
  files: UploadSourcesInput,
): Promise<StoredFile[]> => {
  return Promise.all(
    files.map(async (file) => {
      const key = `documents/${studentId}/${randomUUID()}.${extensions[file.mimetype] ?? "bin"}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: ASSETS_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return { ...file, key };
    }),
  );
};

const saveDocuments = async (
  studentId: string,
  type: StudentDocumentType,
  files: StoredFile[],
  records: MatchedRecord[],
): Promise<StudentDocumentDto[]> => {
  const saved = await meRepo.saveDocuments(
    studentId,
    files.map((file) => ({
      type,
      fileName: file.originalname,
      fileUrl: file.key,
      mimeType: file.mimetype,
      fileSize: file.size,
    })),
    records,
  );

  return saved.map(toDocumentDto);
};

export const uploadDocuments = async (
  userId: string,
  type: StudentDocumentType,
  files: UploadSourcesInput,
): Promise<StudentDocumentDto[]> => {
  const { id, university, major } = await getSelection(userId);

  const transcript = await extractTranscriptFromFiles(
    { name: university.name, major: major.name },
    files,
  );
  const records = await matchRecordsToMajorCourses(major, transcript.records);
  const stored = await storeFiles(id, files);
  return saveDocuments(id, type, stored, records);
};
