import { StudentDocumentType } from "../../../generated/prisma/client.js";
import AppErr from "../../../libs/appErr.js";
import { aiMessage, parseAiJson } from "../../../libs/model.js";
import {
  getPortalTranscript,
  stopPortalSession,
} from "../../../libs/portal/session.js";
import { TRANSCRIPT_EXTRACTION_PROMPT } from "../../../libs/prompt.js";
import { portalConfig } from "../../../config/portal.js";
import { transcriptDataSchema, type TranscriptData } from "../../../schemas/me.schema.js";
import type { StudentDocumentDto } from "../../../types/me.dto.js";
import {
  matchRecordsToMajorCourses,
  saveDocuments,
  storeDocument,
} from "../documents/upload-documents.service.js";
import { getSelection } from "../university/index.js";

/**
 * Sends the transcript text captured from the portal to the AI, which returns the
 * course records as JSON ({ records: [...] }, the same shape as for uploaded files).
 * The page is plain text, so it goes through OpenRouter. Web search stays off: the
 * records must come from the transcript only, never from the internet.
 */
const extractTranscriptFromText = async (
  input: { universityName: string; majorName: string },
  document: { fileName: string; text: string },
): Promise<TranscriptData> => {
  const reply = await aiMessage(
    TRANSCRIPT_EXTRACTION_PROMPT,
    JSON.stringify({
      ...input,
      documents: [
        { fileName: document.fileName, text: document.text.slice(0, portalConfig.maxTextLength) },
      ],
    }),
    { webSearch: false },
  );

  const result = transcriptDataSchema.safeParse(parseAiJson(reply));
  if (!result.success) throw new AppErr("AI returned invalid transcript data", 502);
  return result.data;
};

/**
 * Imports the transcript open in the student's portal browser:
 *   1. capture the page (HTML → text, or the transcript PDF's text)
 *   2. AI extracts the course records as JSON, validated with Zod
 *   3. keep only courses that exist in the student's major
 *   4. store the page like an uploaded transcript and replace the academic records
 *   5. close the remote browser: it's no longer needed
 */
export const importPortalTranscript = async (userId: string): Promise<StudentDocumentDto[]> => {
  const { id, university, major } = await getSelection(userId);
  const capture = await getPortalTranscript(userId);

  const transcript = await extractTranscriptFromText(
    { universityName: university.name.trim(), majorName: major.name.trim() },
    { fileName: `Student portal: ${capture.title || "transcript"}`, text: capture.text },
  );
  const records = await matchRecordsToMajorCourses(major, transcript.records);

  const extension = capture.file.mimeType === "application/pdf" ? "pdf" : "html";
  const key = await storeDocument(id, capture.file.buffer, capture.file.mimeType);
  const documents = await saveDocuments(
    id,
    StudentDocumentType.TRANSCRIPT,
    [
      {
        originalname: `portal-transcript.${extension}`,
        key,
        mimetype: capture.file.mimeType,
        size: capture.file.buffer.length,
      },
    ],
    records,
  );

  await stopPortalSession(userId, "Transcript imported");
  return documents;
};
