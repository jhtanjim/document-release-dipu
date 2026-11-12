import type { Metadata } from "next";
import { Anek_Bangla } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

// One family for Bangla, English and numbers: clear at small sizes, friendly at large ones.
const anek = Anek_Bangla({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-anek",
});

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
      </head>
      <body className={`${anek.variable} antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
