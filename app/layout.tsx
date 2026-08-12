import type { Metadata } from "next";
import { LlmStatusBanner } from "@/components/system/LlmStatusBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsightMe | 自分を知る、仕事を見つける",
  description:
    "AIとの対話を通じて「本当の自分」への気づきを得て、将来の職業候補を見つけるインターン生向けアプリ。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LlmStatusBanner />
        {children}
      </body>
    </html>
  );
}
