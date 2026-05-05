export type SharePayload = {
  score: number;
  headline: string;
};

/** Edge / Node どちらでも動く base64url → UTF-8（Buffer に依存しない） */
function base64UrlToUtf8(input: string): string {
  const trimmed = input.trim();
  const base64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad === 0 ? base64 : base64 + "=".repeat(4 - pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeShareToken(p: SharePayload): string {
  return utf8ToBase64Url(JSON.stringify(p));
}

export function decodeShareToken(token: string): SharePayload | null {
  try {
    const raw = base64UrlToUtf8(token);
    const p = JSON.parse(raw) as SharePayload;
    if (typeof p.score !== "number" || typeof p.headline !== "string")
      return null;
    if (p.score < 35 || p.score > 75) return null;
    return p;
  } catch {
    return null;
  }
}
