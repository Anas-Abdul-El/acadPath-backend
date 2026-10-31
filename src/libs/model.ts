import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";

config();

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_KEY,
  // timeout: aiConfig.timeoutMs,
  // maxRetries: aiConfig.maxRetries,
});

export const aiMessage = async (
  prompt: string,
  content: string,
): Promise<string | null> => {
  const response = await client.chat.completions.create({
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content,
      },
    ],
    tools: [
      {
        type: "openrouter:web_search",
        parameters: {
          engine: "exa",
          max_results: 5,
        },
      } as any,
    ],
  });

  return response.choices[0]?.message.content ?? null;
};

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const geminiMessage = async (
  prompt: string,
  content: string,
  files: { buffer: Buffer; mimeType: string }[],
): Promise<string | null> => {
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { text: content },
      ...files.map(({ buffer, mimeType }) => ({
        inlineData: { data: buffer.toString("base64"), mimeType },
      })),
    ],
    config: {
      systemInstruction: prompt,
      responseMimeType: "application/json",
    },
  });

  return response.text ?? null;
};
