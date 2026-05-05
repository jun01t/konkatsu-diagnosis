import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decodeShareToken } from "@/lib/share-token";
import { siteUrl } from "@/lib/site";

/** Next 13 は同期、15+ は Promise のため両対応 */
type Props = {
  params: { token: string } | Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await Promise.resolve(params);
  // 自己 HTTP フェッチ（VERCEL_URL 等）に依存しない。トークンから直接復元する。
  const meta = decodeShareToken(token);
  if (!meta) {
    return { title: "見つかりません" };
  }
  const base = siteUrl();
  const path = `/share/${token}`;
  const abs = `${base}${path}`;
  const image = `${base}/og-default.svg`;
  const title = `婚活偏差値っぽいスコア: ${meta.score}`;
  return {
    title,
    description: meta.headline,
    openGraph: {
      type: "website",
      title,
      description: meta.headline,
      url: abs,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: meta.headline,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await Promise.resolve(params);
  const meta = decodeShareToken(token);
  if (!meta) notFound();

  return (
    <main className="share-main">
      <p className="eyebrow">婚活偏差値診断（エンタメ）</p>
      <h1 className="bigscore">{meta.score}</h1>
      <p className="headline">{meta.headline}</p>
      <p className="fineprint">
        このページは共有リンク用です。スコアは比喩であり、人の価値を測るものではありません。
      </p>
      <p>
        <Link href="/" className="btn primary">
          診断をやってみる
        </Link>
      </p>
    </main>
  );
}
