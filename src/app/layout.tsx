import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Furago - フランス語学習・読解＆リスニングアプリ",
  description:
    "レベル別（超初級〜上級）のフランス語記事、ワンタップ辞書・文脈翻訳、ネイティブ音声読み上げ、理解度クイズで楽しくフランス語を学べるWebアプリ。",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Furago",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
