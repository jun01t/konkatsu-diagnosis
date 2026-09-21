import { ALL_QUESTIONS, SCORE_GUIDE } from "./questions-data";
import type { Question } from "./types";

const GATEWAY_CHAT_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

function hasGatewayAuth(): boolean {
  return Boolean(
    (process.env.AI_GATEWAY_API_KEY ?? "").trim() ||
      (process.env.VERCEL_OIDC_TOKEN ?? "").trim()
  );
}

function gatewayModel(): string {
  const raw = (
    process.env.AI_GATEWAY_MODEL ??
    process.env.OPENAI_MODEL ??
    "openai/gpt-4o-mini"
  ).trim();
  if (raw.includes("/")) return raw;
  return `openai/${raw}`;
}

export type DiagnoseResult = {
  score: number;
  headline: string;
  bullets: string[];
  shareText: string;
};

function normalizeChoiceValue(v: string): string {
  const t = v.trim();
  if (!t) return "";
  const r = [...t];
  if (r.length === 1) {
    const c = r[0];
    if (c === "１") return "1";
    if (c === "２") return "2";
    if (c === "３") return "3";
    if (c === "４") return "4";
  }
  return t;
}

export function canonicalizeAnswers(
  answers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) {
    let v = (answers[q.id] ?? "").trim();
    if (!v) {
      for (const [k, val] of Object.entries(answers)) {
        if (k.trim().toLowerCase() === q.id.toLowerCase()) {
          v = val.trim();
          break;
        }
      }
    }
    out[q.id] = normalizeChoiceValue(v);
  }
  return out;
}

export function scoreFromAnswers(answers: Record<string, string>): number {
  const n = ALL_QUESTIONS.length;
  if (n === 0) return 35;
  let sum = 0;
  for (const q of ALL_QUESTIONS) {
    const v = answers[q.id];
    switch (v) {
      case "1":
        sum += 4;
        break;
      case "2":
        sum += 3;
        break;
      case "3":
        sum += 2;
        break;
      case "4":
        sum += 1;
        break;
      default:
        sum += 2;
    }
  }
  const minSum = n * 1;
  const maxSum = n * 4;
  if (minSum >= maxSum) return 40;
  let score = 40 + ((sum - minSum) * 30) / (maxSum - minSum);
  score = Math.floor(score);
  if (score < 35) score = 35;
  if (score > 75) score = 75;
  return score;
}

function optionLabel(q: Question, value: string): string {
  const o = q.options.find((x) => x.value === value);
  return o?.label ?? "";
}

function buildUserContent(answers: Record<string, string>, ref: number): string {
  let s =
    "次の設問に対する回答です。\n" +
    "各 value は 1=その項目で最も好調・4=改善余地が大きい（数字が小さいほど良い回答）。\n\n";
  for (const q of ALL_QUESTIONS) {
    const v = answers[q.id];
    const lbl = optionLabel(q, v);
    s += `- ${q.id} ${q.text} => value=${v}`;
    if (lbl) s += `（${lbl}）`;
    s += "\n";
  }
  s += `\n【算出済み・この値を JSON の score に必ず使う】婚活偏差値っぽいスコア（目安）: ${ref}\n`;
  s +=
    "（value=1 が多いほどこの数値は高く、value=4 が多いほど低くなる計算です。）";
  return s;
}

function normalizeResult(r: DiagnoseResult): DiagnoseResult {
  let score = r.score;
  if (score < 35) score = 35;
  if (score > 75) score = 75;
  let bullets = r.bullets ?? [];
  if (bullets.length > 3) bullets = bullets.slice(0, 3);
  let shareText = (r.shareText ?? "").trim();
  const runes = [...shareText];
  if (runes.length > 280) shareText = runes.slice(0, 280).join("");
  return { ...r, score, bullets, shareText };
}

function mockResult(answers: Record<string, string>): DiagnoseResult {
  const score = scoreFromAnswers(answers);
  let headline = "いまのペースを整えると伸びしろがあります";
  if (score >= 60) {
    headline = "土台は良いので、言語化と行動量でさらに安定しそう";
  }
  const bullets = [
    "プロフィールは「目的・週の稼働・得意」を一文ずつ足すと伝わりやすい",
    "初回メッセージは相手プロフィールの一要素に触れると続きやすい",
    "疲れが続くなら、接触頻度より睡眠と回復ルートを先に整える",
  ];
  const shareText = `婚活偏差値っぽいスコア: ${score}（診断・エンタメ）\n${headline}\n#婚活偏差値診断`;
  return { score, headline, bullets, shareText };
}

async function callGateway(
  answers: Record<string, string>
): Promise<DiagnoseResult> {
  const ref = scoreFromAnswers(answers);
  const userPayload = buildUserContent(answers, ref);
  const sys = `あなたは日本語の婚活コーチのトーンで、短く具体的に返す。
${SCORE_GUIDE}
必ず次のJSONだけを返す（説明文やコードフェンスは禁止）:
{"headline":"28文字以内の前向きな一言","bullets":["箇条書き1","箇条書き2","箇条書き3"],"shareText":"X投稿用"}

score はサーバー側で ${ref} に固定する（JSON に含めなくてよい）。
bulletsは各40文字以内。shareTextには「婚活偏差値${ref}」「#婚活偏差値診断」を含める（280文字以内）。
「改善」「見直し」中心の文言はスコアが低いときだけ。スコアが高めのときは強みの維持・仕上げの観点を中心に。`;

  const apiKey = (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    ""
  ).trim();

  const res = await fetch(GATEWAY_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: gatewayModel(),
      temperature: 0.5,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userPayload },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`ai-gateway: ${res.status} ${raw.slice(0, 240)}`);
  }

  const cr = JSON.parse(raw) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (cr.error?.message) throw new Error(cr.error.message);
  const content = (cr.choices?.[0]?.message?.content ?? "").trim();
  const jsonStr = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  const out = JSON.parse(jsonStr) as Omit<DiagnoseResult, "score">;
  return normalizeResult({
    score: ref,
    headline: out.headline,
    bullets: out.bullets,
    shareText: out.shareText,
  });
}

export async function diagnose(
  answers: Record<string, string>
): Promise<DiagnoseResult> {
  const clean = canonicalizeAnswers(answers);
  if (!hasGatewayAuth()) {
    return mockResult(clean);
  }
  return callGateway(clean);
}
