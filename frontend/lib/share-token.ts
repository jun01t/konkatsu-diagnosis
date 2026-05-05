export type SharePayload = {
  score: number;
  headline: string;
};

export function encodeShareToken(p: SharePayload): string {
  const json = JSON.stringify(p);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeShareToken(token: string): SharePayload | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const p = JSON.parse(raw) as SharePayload;
    if (typeof p.score !== "number" || typeof p.headline !== "string")
      return null;
    if (p.score < 35 || p.score > 75) return null;
    return p;
  } catch {
    return null;
  }
}
