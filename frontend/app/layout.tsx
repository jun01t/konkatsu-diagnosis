import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "婚活偏差値診断（AI）— エンタメ自己理解用",
  description:
    "設問に答えるとプロフィール・行動・マインドのバランスを偏差値っぽいスコアでまとめます（エンタメ）。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
