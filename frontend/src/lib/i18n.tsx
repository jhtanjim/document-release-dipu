"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

/** The saved language, readable outside React (used for API requests). */
export function currentLang(): Lang {
  try {
    return localStorage.getItem("lang") === "en" ? "en" : "bn";
  } catch {
    return "bn";
  }
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "bn", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");
  useEffect(() => {
    const l = currentLang();
    setLangState(l);
    document.documentElement.lang = l;
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("lang", l);
    } catch {}
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

/** `t("বাংলা", "English")` picks the text for the chosen language. */
export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((bn: string, en: string) => (lang === "en" ? en : bn), [lang]);
  return { lang, setLang, t };
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex rounded-md border border-line bg-sunk p-0.5" role="group" aria-label="Language / ভাষা">
      {(
        [
          ["bn", "বাংলা"],
          ["en", "English"],
        ] as const
      ).map(([l, label]) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded px-2.5 py-1 text-[12.5px] font-semibold transition ${
            lang === l ? "bg-surface text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
