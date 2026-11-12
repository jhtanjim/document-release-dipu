import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "গারান্টি রিলিজ · Guarantee Release",
  description: "জব, সার্ভে, শিপিং এজেন্টের হিসাব আর গারান্টি রিলিজ ট্র্যাকিং · Job, survey, agent bill and guarantee release tracking",
};

// Applies the saved light/dark choice before the first paint, so the page never flashes.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Anek Bangla: one family for Bangla, English and numbers. Loaded by the browser, so the build never depends on it. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700&display=swap" />
      </head>
      <body className="antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
