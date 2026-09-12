import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set in environment");
    }
    // maxRetries covers 429/5xx/connection errors; the default (2) is a little
    // thin for background triggers that have no user to retry for them.
    client = new Anthropic({ apiKey, maxRetries: 4 });
  }
  return client;
}

/** Claude Haiku 4.5 — cheapest current-generation model, ample for these
 *  classification/extraction workloads and fast enough for a callable. */
export const MODEL = "claude-haiku-4-5";

const JSON_MAX_TOKENS = 8000;
const TEXT_MAX_TOKENS = 4000;

const JSON_SYSTEM =
  "You are a precise analysis engine. Respond with a single raw JSON object " +
  "that matches the requested structure exactly. Do not wrap it in markdown " +
  "code fences and do not add any commentary before or after the JSON.";

export type JSONSchema = Record<string, unknown>;

function collectText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function assertUsableStop(message: Anthropic.Message): void {
  if (message.stop_reason === "refusal") {
    const detail = message.stop_details?.explanation || message.stop_details?.category || "";
    throw new Error(`Claude declined the request${detail ? `: ${detail}` : ""}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Claude response was truncated by max_tokens");
  }
}

/**
 * Pull a JSON object out of a model response. Structured outputs make the
 * happy path a plain JSON.parse; the fence/brace fallbacks only matter if the
 * schema is omitted.
 */
function parseJSON<T>(text: string): T {
  const candidates = [text];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next shape
    }
  }

  console.error("Failed to parse Claude JSON response (first 500 chars):", text.slice(0, 500));
  throw new Error("Invalid JSON response from Claude");
}

/**
 * Ask Claude for a JSON object. Pass a JSON Schema to have the API constrain
 * the response shape (structured outputs) — strongly preferred, since it
 * removes the whole class of "model returned prose" failures.
 */
export async function generateJSON<T>(prompt: string, schema?: JSONSchema): Promise<T> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: JSON_MAX_TOKENS,
    temperature: 0.3,
    system: JSON_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    ...(schema ? { output_config: { format: { type: "json_schema" as const, schema } } } : {}),
  });

  assertUsableStop(message);
  return parseJSON<T>(collectText(message));
}

export async function generateText(prompt: string): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: TEXT_MAX_TOKENS,
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }],
  });

  assertUsableStop(message);
  return collectText(message);
}
