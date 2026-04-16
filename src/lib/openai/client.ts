import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: serverEnv().OPENAI_API_KEY });
  }
  return _client;
}

// Model IDs are read through the env module so a missing var defaults
// to the same fallbacks as before (gpt-4o / gpt-image-1). Lazy getters
// so import-time doesn't crash in tooling that reads this module
// without the env loaded.
export const OPENAI_TEXT_MODEL = (() => {
  try {
    return serverEnv().OPENAI_TEXT_MODEL;
  } catch {
    return "gpt-4o";
  }
})();

export const OPENAI_IMAGE_MODEL = (() => {
  try {
    return serverEnv().OPENAI_IMAGE_MODEL;
  } catch {
    return "gpt-image-1";
  }
})();
