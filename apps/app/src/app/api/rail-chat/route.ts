import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages: ChatMessage[];
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const ROOT_ENV_PATH = join(process.cwd(), "..", "..", ".env");

function parseEnvValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const isQuoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return isQuoted ? trimmed.slice(1, -1).trim() : trimmed;
}

function readEnvValueFromRootFile(key: string) {
  if (!existsSync(ROOT_ENV_PATH)) {
    return "";
  }

  const fileContent = readFileSync(ROOT_ENV_PATH, "utf8");
  const lines = fileContent.split(/\r?\n/);
  const targetPrefix = `${key}=`;

  for (const line of lines) {
    const sanitized = line.trim();
    if (!sanitized || sanitized.startsWith("#")) continue;
    if (!sanitized.startsWith(targetPrefix)) continue;

    const rawValue = sanitized.slice(targetPrefix.length);
    return parseEnvValue(rawValue);
  }

  return "";
}

function getEnvValue(key: string, fallback = "") {
  return readEnvValueFromRootFile(key) || fallback;
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.content?.trim())
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

function extractTextFromGemini(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: any) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnvValue("GEMINI_API_KEY");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as ChatRequestBody;
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "messages is required and cannot be empty." },
        { status: 400 },
      );
    }

    const contents = toGeminiContents(messages);
    const model = getEnvValue("GEMINI_CHAT_MODEL", DEFAULT_MODEL);

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [
              {
                text: "You are a helpful rail operations assistant. Answer clearly and concisely in Vietnamese unless the user asks otherwise.",
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "LLM request failed.", detail: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    const text = extractTextFromGemini(data);

    if (!text) {
      return NextResponse.json(
        { error: "LLM returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: text });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected error while calling LLM.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
