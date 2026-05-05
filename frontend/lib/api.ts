import type { DiagnoseResponse, Question } from "./types";

/**
 * 外部 Go API を使うときのベース URL。未設定なら空文字＝同一オリジン（Vercel / `next dev` の Route Handlers）。
 */
export function getPublicApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) return "";
  return u.replace(/\/$/, "");
}

/** `/api/...` への URL（相対 or 絶対） */
export function apiUrl(path: string): string {
  const base = getPublicApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/**
 * サーバー側（generateMetadata 等）の API ベース。
 * Vercel では `VERCEL_URL` で自デプロイに向ける。
 */
export function getServerApiBase(): string {
  const u = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/\/$/, "")}`;
  return "http://127.0.0.1:3000";
}

export async function fetchQuestions(): Promise<Question[]> {
  const res = await fetch(apiUrl("/api/questions"), {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("failed to load questions");
  return res.json();
}

export async function postDiagnose(
  answers: Record<string, string>
): Promise<DiagnoseResponse> {
  const res = await fetch(apiUrl("/api/diagnose"), {
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
  const enc = encodeURIComponent(token);
  const res = await fetch(`${getServerApiBase()}/api/share/${enc}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}
