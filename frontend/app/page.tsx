"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiagnoseResponse, Question } from "@/lib/types";
import { fetchQuestions, getPublicApiBase, postDiagnose } from "@/lib/api";

export default function HomePage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [xHref, setXHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = await fetchQuestions();
        if (!cancelled) setQuestions(q);
      } catch {
        if (!cancelled)
          setLoadError(
            `設問の取得に失敗しました。Go API が ${getPublicApiBase()} で起動しているか確認してください。`
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSelect = useCallback((qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      if (!questions) return;
      for (const q of questions) {
        if (!answers[q.id]?.trim()) {
          setSubmitError("すべての設問に回答してください。");
          return;
        }
      }
      setPending(true);
      try {
        const data = await postDiagnose(answers);
        setResult(data);
        const origin = window.location.origin;
        const sharePage = `${origin}${data.sharePath}`;
        const text =
          data.shareText ||
          `婚活偏差値っぽいスコア: ${data.score}\n${data.headline}\n#婚活偏差値診断`;
        const intent =
          "https://twitter.com/intent/tweet?text=" +
          encodeURIComponent(text) +
          "&url=" +
          encodeURIComponent(sharePage);
        setXHref(intent);
      } catch {
        setSubmitError("送信に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setPending(false);
      }
    },
    [answers, questions]
  );

  const retry = useCallback(() => {
    setResult(null);
    setAnswers({});
    setXHref(null);
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loadError) {
    return (
      <main className="loading">
        <p>{loadError}</p>
      </main>
    );
  }

  if (!questions) {
    return (
      <main className="loading">
        <p>読み込み中…</p>
      </main>
    );
  }

  return (
    <>
      <header className="hero">
        <h1>婚活偏差値診断（AI）</h1>
        <p className="lead">
          設問に答えると、プロフィール・行動・マインドのバランスを
          <span className="nowrap">「偏差値っぽいスコア」</span>
          でまとめます。
        </p>
      </header>

      <aside className="notice" role="note">
        <strong>免責・利用目的:</strong>
        この診断はエンタメおよび自己理解のためのものであり、医学・心理学の診断、学歴、収入、人としての価値を測るものではありません。結果は参考情報です。
      </aside>

      {!result ? (
        <form className="quiz" onSubmit={onSubmit} noValidate>
          {questions.map((q) => (
            <fieldset key={q.id} className="q">
              <legend>
                <span className="cat">{q.category}</span> {q.text}
              </legend>
              <div className="opts">
                {q.options.map((opt) => (
                  <label key={opt.value} className="opt">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={answers[q.id] === opt.value}
                      onChange={() => onSelect(q.id, opt.value)}
                      required
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "送信中…" : "結果を見る"}
          </button>
          {submitError && (
            <p className="error" role="alert">
              {submitError}
            </p>
          )}
        </form>
      ) : (
        <section className="result">
          <h2>診断結果</h2>
          <p className="scoreline">
            婚活偏差値っぽいスコア:{" "}
            <span style={{ color: "var(--accent2)" }}>{result.score}</span>
          </p>
          <p className="headline">{result.headline}</p>
          <ul className="bullets">
            {(result.bullets ?? []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <div className="actions">
            {xHref && (
              <a
                className="btn x"
                href={xHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Xで結果を共有
              </a>
            )}
            <button type="button" className="btn ghost" onClick={retry}>
              もう一度
            </button>
          </div>
          <p className="fineprint">
            バックエンドに <code>OPENAI_API_KEY</code> が無い場合はモック結果になります。
          </p>
        </section>
      )}

      <footer className="foot">
        <p>
          フロント: Next.js / API: Go（<code>NEXT_PUBLIC_API_URL</code>）。本番は{" "}
          <code>CORS_ORIGINS</code> にフロントのオリジンを追加してください。
        </p>
      </footer>
    </>
  );
}
