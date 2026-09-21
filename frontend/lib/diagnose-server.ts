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

export type CategoryNotes = {
  profile: string;
  communication: string;
  action: string;
  mind: string;
};

export type DiagnoseResult = {
  score: number;
  headline: string;
  summary: string;
  bullets: string[];
  nextActions: string[];
  categoryNotes: CategoryNotes;
  messageExample: string;
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

function clipRunes(s: string, max: number): string {
  const t = (s ?? "").trim();
  const runes = [...t];
  return runes.length > max ? runes.slice(0, max).join("") : t;
}

function clipList(items: string[] | undefined, maxItems: number, maxLen: number): string[] {
  return (items ?? [])
    .map((x) => clipRunes(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function emptyNotes(): CategoryNotes {
  return { profile: "", communication: "", action: "", mind: "" };
}

function normalizeResult(r: DiagnoseResult): DiagnoseResult {
  let score = r.score;
  if (score < 35) score = 35;
  if (score > 75) score = 75;
  const notes = r.categoryNotes ?? emptyNotes();
  return {
    score,
    headline: clipRunes(r.headline, 40),
    summary: clipRunes(r.summary, 400),
    bullets: clipList(r.bullets, 5, 90),
    nextActions: clipList(r.nextActions, 3, 90),
    categoryNotes: {
      profile: clipRunes(notes.profile, 140),
      communication: clipRunes(notes.communication, 140),
      action: clipRunes(notes.action, 140),
      mind: clipRunes(notes.mind, 140),
    },
    messageExample: clipRunes(r.messageExample, 180),
    shareText: clipRunes(r.shareText, 280),
  };
}

function mockResult(answers: Record<string, string>): DiagnoseResult {
  const score = scoreFromAnswers(answers);
  const high = score >= 60;
  const headline = high
    ? "土台は良いので、言語化と行動量でさらに安定しそう"
    : "いまのペースを整えると伸びしろがあります";
  const summary = high
    ? "いまの回答からは、プロフィール・会話・行動のどれかがすでに形になっている印象です。このまま勢いで進めるより、相手に伝わる言葉を少し足し、会うまでの導線を週単位で固定すると、出会いの質が安定しやすいです。回復のルートも確保できているなら、その調子を崩さないことがいちばんの伸びしろです。"
    : "いまの回答からは、整えたいポイントがはっきり見える段階です。一気に全部を変えず、プロフィールの一文、最初のメッセージ、会う提案のどれか1つを先に整えると動きやすいです。疲れが強いときは接触量より睡眠と回復を優先しても、診断上はむしろ健全な判断です。";
  const bullets = [
    "自己紹介は「会う目的・大事にしていること・週の稼働」を一文ずつ足すと、相手が想像しやすくなります。",
    "写真は顔・全身・活動の3枚があると雰囲気が伝わり、古い1枚だけより信頼感が出やすいです。",
    "初回メッセージは相手プロフィールの具体を1つ拾って質問すると、テンプレ感が減って続きやすいです。",
    "日程は候補日を2〜3日出すと、相手任せになりにくく間が空きにくくなります。",
    "疲れが続くならアプリの接触頻度より、睡眠・運動・友人など回復ルートを先に整えると続きやすいです。",
  ];
  const nextActions = [
    "今日中に自己紹介を3行だけ書き直す（目的・価値観・稼働）。",
    "今週、相手プロフィールに触れた初回メッセージを3通送る。",
    "会う提案をするなら、候補日を2日以上セットで出す。",
  ];
  const categoryNotes: CategoryNotes = {
    profile: `自己紹介は「${optionLabel(ALL_QUESTIONS[0], answers.q1)}」、写真は「${optionLabel(ALL_QUESTIONS[1], answers.q2)}」。伝わる材料を足すほど、最初の印象が安定します。`,
    communication: `初回メッセージは「${optionLabel(ALL_QUESTIONS[2], answers.q3)}」、返信は「${optionLabel(ALL_QUESTIONS[3], answers.q4)}」。具体と丁寧さが続くと温度が落ちにくいです。`,
    action: `出会いの行動量は「${optionLabel(ALL_QUESTIONS[4], answers.q5)}」、日程調整は「${optionLabel(ALL_QUESTIONS[5], answers.q6)}」。週のルーティンに落とすとムラが減ります。`,
    mind: `条件整理は「${optionLabel(ALL_QUESTIONS[6], answers.q7)}」、ストレス処理は「${optionLabel(ALL_QUESTIONS[7], answers.q8)}」。譲れる点を言語化すると迷いが減ります。`,
  };
  const messageExample =
    "プロフィールの◯◯、とても印象的でした。休日の過ごし方で大切にしていることはありますか？よければ近いうちにカフェでお話しできたらうれしいです。";
  const shareText = `婚活偏差値っぽいスコア: ${score}（診断・エンタメ）\n${headline}\n#婚活偏差値診断`;
  return {
    score,
    headline,
    summary,
    bullets,
    nextActions,
    categoryNotes,
    messageExample,
    shareText,
  };
}

async function callGateway(
  answers: Record<string, string>
): Promise<DiagnoseResult> {
  const ref = scoreFromAnswers(answers);
  const userPayload = buildUserContent(answers, ref);
  const sys = `あなたは日本語の婚活コーチ。回答内容に触れながら、具体的で前向きに書く。抽象論や人の価値の判定は禁止。
${SCORE_GUIDE}
必ず次のJSONだけを返す（説明文やコードフェンスは禁止）:
{"headline":"40文字以内の前向きな一言","summary":"全体総評。3〜5文、200〜350字。回答の具体に触れる","bullets":["アドバイス1","2","3","4","5"],"nextActions":["今週やること1","2","3"],"categoryNotes":{"profile":"プロフィール評80〜130字","communication":"コミュニケーション評80〜130字","action":"行動評80〜130字","mind":"マインド評80〜130字"},"messageExample":"初回メッセージ例。80〜160字。丁寧で続きやすい","shareText":"X投稿用"}

score はサーバー側で ${ref} に固定する（JSON に含めなくてよい）。
bulletsは5件・各90文字以内。nextActionsは実行可能な今週タスク。
shareTextには「婚活偏差値${ref}」「#婚活偏差値診断」を含める（280文字以内）。
スコアが高めなら強みの維持と仕上げ、低めなら負担の少ない一歩を中心に。`;

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
    summary: out.summary,
    bullets: out.bullets,
    nextActions: out.nextActions,
    categoryNotes: out.categoryNotes ?? emptyNotes(),
    messageExample: out.messageExample,
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
