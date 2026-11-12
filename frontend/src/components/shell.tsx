"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarClock, ChevronDown, Lock, LogOut, Monitor, Moon, Plus, Ship, Sun } from "lucide-react";
import { api } from "@/lib/api";
import type { Me, OperatorRequest, Subscription } from "@/lib/types";
import { ROLE_LABEL, fd } from "@/lib/format";
import { LangSwitch, useLang } from "@/lib/i18n";
import { Loading } from "./ui";

const UserCtx = createContext<Me | null>(null);
export const useMe = () => useContext(UserCtx);

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/** Lets a page tell the shell that the subscription or requests changed. */
const RefreshCtx = createContext<() => void>(() => {});
export const useShellRefresh = () => useContext(RefreshCtx);

const NAV = [
  { href: "/", bn: "হোম", en: "Home" },
  { href: "/jobs", bn: "সব জব", en: "Jobs" },
  { href: "/statement", bn: "স্টেটমেন্ট", en: "Statement" },
  { href: "/settings", bn: "সেটিংস", en: "Settings" },
];

type ThemeChoice = "system" | "light" | "dark";
const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" };

/** One button that cycles light → dark → follow the computer. */
function ThemeButton() {
  const { t } = useLang();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      const v = localStorage.getItem("theme");
      if (v === "light" || v === "dark") setTheme(v);
    } catch {}
  }, []);
  const cycle = () => {
    const v = NEXT_THEME[theme];
    setTheme(v);
    try {
      if (v === "system") {
        localStorage.removeItem("theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("theme", v);
        document.documentElement.dataset.theme = v;
      }
    } catch {}
  };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "light" ? t("সাদা থিম", "Light theme") : theme === "dark" ? t("কালো থিম", "Dark theme") : t("কম্পিউটারের মতো", "Follow computer");
  return (
    <button type="button" onClick={cycle} title={label} aria-label={label} className="grid size-9 place-items-center rounded-lg text-brand-ink/80 hover:bg-white/10 hover:text-brand-ink">
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}

/** Compact language switch for the dark header band. */
function HeaderLang() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex rounded-lg bg-white/10 p-0.5 text-[13px] font-semibold" role="group" aria-label="Language / ভাষা">
      {(
        [
          ["bn", "বাংলা"],
          ["en", "EN"],
        ] as const
      ).map(([l, label]) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-md px-2.5 py-1 ${lang === l ? "bg-white text-brand" : "text-brand-ink/80 hover:text-brand-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function UserMenu({ me, sub, onLogout }: { me: Me; sub: Subscription; onLogout: () => void }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-white/10"
      >
        <span className="grid size-8 place-items-center rounded-full bg-white/15 text-[15px] font-bold">{me.name.slice(0, 1)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[14px] font-semibold">{me.name}</span>
          <span className="block text-[12px] opacity-75">{ROLE_LABEL[lang][me.role]}</span>
        </span>
        <ChevronDown className="size-4 opacity-75" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-xl">
          <div className="border-b border-line p-4">
            <p className="font-semibold">{me.name}</p>
            <p className="text-sm text-muted">{me.email}</p>
            <p className="mt-1 text-sm text-muted">{ROLE_LABEL[lang][me.role]}</p>
          </div>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm">
            <CalendarClock className={`size-4 ${sub.status === "ACTIVE" ? "text-good" : sub.status === "EXPIRING" ? "text-warn" : "text-crit"}`} aria-hidden />
            <span>
              {sub.status === "EXPIRED"
                ? t("সাবস্ক্রিপশন শেষ", "Subscription expired")
                : t(`সাবস্ক্রিপশন ${fd(sub.endsAt)} পর্যন্ত`, `Subscription until ${fd(sub.endsAt)}`)}
            </span>
          </div>
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold text-crit hover:bg-crit-bg">
            <LogOut className="size-4" aria-hidden /> {t("লগআউট", "Log out")}
          </button>
        </div>
      )}
    </div>
  );
}

function LockScreen({ me, sub, onLogout }: { me: Me; sub: Subscription; onLogout: () => void }) {
  const { t } = useLang();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-card">
        <div className="mb-4 flex justify-center">
          <LangSwitch />
        </div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-crit-bg text-crit">
          <Lock className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">{t("সাবস্ক্রিপশনের মেয়াদ শেষ", "Subscription expired")}</h1>
        <p className="mt-2 text-muted">
          {t(
            `${fd(sub.endsAt)} তারিখে সফটওয়্যারের মেয়াদ শেষ হয়েছে। আবার চালু করতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন। আপনার সব ডেটা নিরাপদে সেভ আছে।`,
            `The software subscription ended on ${fd(sub.endsAt)}. Please contact the super admin to renew it. All your data is safely saved.`,
          )}
        </p>
        <p className="mt-4 text-sm text-muted">
          {t("লগইন করা আছেন", "Signed in as")}: <b className="text-ink">{me.name}</b>
        </p>
        <button onClick={onLogout} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 font-semibold hover:border-accent">
          <LogOut className="size-4" aria-hidden /> {t("লগআউট", "Log out")}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const [me, setMe] = useState<Me | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    api<Subscription>("/subscription").then(setSub).catch(() => {});
    if (me.role === "SUPER_ADMIN")
      api<OperatorRequest[]>("/operator-requests")
        .then((r) => setPending(r.filter((x) => x.status === "PENDING").length))
        .catch(() => {});
  }, [me, path, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 3000);
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (!me || !sub)
    return (
      <div className="mx-auto max-w-6xl px-4">
        <Loading />
      </div>
    );
  if (!sub.active && me.role !== "SUPER_ADMIN") return <LockScreen me={me} sub={sub} onLogout={logout} />;

  const showSubBanner = me.role !== "OPERATOR" && sub.status !== "ACTIVE";

  const navLinks = (
    <>
      {NAV.map(({ href, bn, en }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`relative shrink-0 rounded-lg px-3.5 py-2 text-[15px] font-semibold transition ${
            active(href) ? "bg-white/15 text-brand-ink" : "text-brand-ink/75 hover:bg-white/10 hover:text-brand-ink"
          }`}
        >
          {t(bn, en)}
          {href === "/settings" && pending > 0 && (
            <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-crit px-1.5 text-[11px] font-bold text-white" title={t("অনুমতির অনুরোধ", "Permission requests")}>
              {pending}
            </span>
          )}
        </Link>
      ))}
    </>
  );

  return (
    <UserCtx.Provider value={me}>
      <ToastCtx.Provider value={showToast}>
        <RefreshCtx.Provider value={refresh}>
          <header className="no-print sticky top-0 z-20 bg-brand text-brand-ink shadow-md">
            <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-white text-brand">
                  <Ship className="size-5" aria-hidden />
                </span>
                <span className="hidden leading-tight sm:block">
                  <b className="block text-[16px]">{t("গারান্টি রিলিজ", "Guarantee Release")}</b>
                  <span className="block text-[12px] opacity-70">{t("সিকিউরিটি মানি ট্র্যাকার", "Security money tracker")}</span>
                </span>
              </Link>
              <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label={t("মেনু", "Menu")}>
                {navLinks}
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href="/jobs/new"
                  className="hidden items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[14.5px] font-bold text-brand shadow-sm hover:bg-white/90 sm:flex"
                >
                  <Plus className="size-4" aria-hidden /> {t("নতুন জব", "New job")}
                </Link>
                <HeaderLang />
                <ThemeButton />
                <UserMenu me={me} sub={sub} onLogout={logout} />
              </div>
            </div>
            <nav className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label={t("মেনু", "Menu")}>
              {navLinks}
            </nav>
          </header>

          <main className="mx-auto w-full min-w-0 max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">
            {showSubBanner && (
              <div
                className={`no-print mb-6 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
                  sub.status === "EXPIRED" ? "border-crit/40 bg-crit-bg text-crit" : "border-warn/40 bg-warn-bg text-warn"
                }`}
                role="status"
              >
                <CalendarClock className="size-5 shrink-0" aria-hidden />
                <p className="font-semibold">
                  {sub.status === "EXPIRED"
                    ? t(
                        `সাবস্ক্রিপশনের মেয়াদ ${fd(sub.endsAt)} তারিখে শেষ হয়েছে। অন্যরা এখন কাজ করতে পারছেন না।`,
                        `The subscription ended on ${fd(sub.endsAt)}. Others can't work until it is renewed.`,
                      )
                    : t(
                        `সাবস্ক্রিপশন ${sub.daysLeft} দিন পর (${fd(sub.endsAt)}) শেষ হবে।${sub.autoRenew ? " অটো-রিনিউ চালু আছে।" : " অটো-রিনিউ বন্ধ।"}`,
                        `The subscription ends in ${sub.daysLeft} days (${fd(sub.endsAt)}).${sub.autoRenew ? " Auto-renew is on." : " Auto-renew is off."}`,
                      )}
                </p>
                {me.role === "SUPER_ADMIN" && (
                  <Link href="/settings?tab=subscription" className="ml-auto rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-ink">
                    {t("সাবস্ক্রিপশন দেখুন", "View subscription")}
                  </Link>
                )}
              </div>
            )}
            {children}
          </main>

          <Link
            href="/jobs/new"
            className="no-print fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink shadow-lg sm:hidden"
          >
            <Plus className="size-5" aria-hidden /> {t("নতুন জব", "New job")}
          </Link>

          {toast && (
            <div role="status" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 font-semibold text-surface shadow-lg">
              {toast}
            </div>
          )}
        </RefreshCtx.Provider>
      </ToastCtx.Provider>
    </UserCtx.Provider>
  );
}
