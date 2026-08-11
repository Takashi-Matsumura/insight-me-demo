import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LlmStatusBanner } from "@/components/system/LlmStatusBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightMe | 自分を知る、仕事を見つける",
  description:
    "AIとの対話を通じて「本当の自分」への気づきを得て、将来の職業候補を見つけるインターン生向けアプリ。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LlmStatusBanner />
        {children}
      </body>
    </html>
  );
}
