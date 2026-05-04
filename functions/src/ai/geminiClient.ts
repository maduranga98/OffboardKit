import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set in environment");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const JSON_MODEL = "gemini-2.0-flash";
const TEXT_MODEL = "gemini-2.0-flash";

export async function generateJSON<T>(prompt: string): Promise<T> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: JSON_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("Failed to parse Gemini JSON response (first 500 chars):", text.slice(0, 500));
    throw new Error("Invalid JSON response from Gemini");
  }
}

export async function generateText(prompt: string): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: TEXT_MODEL,
    generationConfig: {
      temperature: 0.4,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}
