import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Furago - フランス語学習・読解＆リスニングアプリ",
  description:
    "レベル別（A1〜C1）のフランス語記事、ワンタップ辞書・文脈翻訳、ネイティブ音声読み上げ、理解度クイズで楽しくフランス語を学べるWebアプリ。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
