import type { DiagnoseResponse, Question } from "./types";

export function getPublicApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) {
    return "http://localhost:8080";
  }
  return u.replace(/\/$/, "");
}

/** サーバー側（generateMetadata 等）で Go API に接続 */
export function getServerApiBase(): string {
  const u = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) {
    return "http://127.0.0.1:8080";
  }
  return u.replace(/\/$/, "");
}

export async function fetchQuestions(): Promise<Question[]> {
  const res = await fetch(`${getPublicApiBase()}/api/questions`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("failed to load questions");
  return res.json();
}

export async function postDiagnose(
  answers: Record<string, string>
): Promise<DiagnoseResponse> {
  const res = await fetch(`${getPublicApiBase()}/api/diagnose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchShareMeta(token: string): Promise<{
  score: number;
  headline: string;
} | null> {
  const res = await fetch(`${getServerApiBase()}/api/share/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}
