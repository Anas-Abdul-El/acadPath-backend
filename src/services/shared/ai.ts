import type { z } from "zod";
import AppErr from "../../libs/appErr.js";
import { aiMessage, parseAiJson } from "../../libs/model.js";

export const askAiForJson = async <T extends z.ZodType>(
  prompt: string,
  payload: unknown,
  schema: T,
  invalidMessage: string,
): Promise<z.output<T>> => {
  let reply: string | null;
  try {
    reply = await aiMessage(prompt, JSON.stringify(payload), {
      webSearch: false,
    });
  } catch (error) {
    throw new AppErr("The AI provider failed, try again later", 502, {
      cause: error,
    });
  }

  const result = schema.safeParse(parseAiJson(reply));
  if (!result.success) throw new AppErr(invalidMessage, 502);
  return result.data;
};
