import OpenAI from "openai";
import { SOURCE_DISCOVERY_PROMPT } from "./prompt.js";
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
