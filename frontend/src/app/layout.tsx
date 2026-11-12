import type { Metadata } from "next";
import { Hind_Siliguri, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

const bangla = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bangla",
});
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex" });

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
      <body className={`${bangla.variable} ${plex.variable} antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
