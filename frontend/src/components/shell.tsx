"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { FileText, Home, ListChecks, Lock, LogOut, Menu, Monitor, Moon, Plus, Settings, Sun, X } from "lucide-react";
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
  { href: "/", bn: "আজকের অবস্থা", en: "Overview", icon: Home },
  { href: "/jobs", bn: "সব জব", en: "All jobs", icon: ListChecks },
  { href: "/statement", bn: "স্টেটমেন্ট", en: "Statement", icon: FileText },
  { href: "/settings", bn: "সেটিংস", en: "Settings", icon: Settings },
];

type ThemeChoice = "system" | "light" | "dark";
const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" };

function useTheme() {
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
  return { theme, cycle };
}

function LockScreen({ me, sub, onLogout }: { me: Me; sub: Subscription; onLogout: () => void }) {
  const { t } = useLang();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-7 text-center">
        <div className="mb-4 flex justify-center">
          <LangSwitch />
        </div>
        <span className="mx-auto grid size-12 place-items-center rounded-md bg-crit-bg text-crit">
          <Lock className="size-6" aria-hidden />
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
        <button onClick={onLogout} className="mt-5 inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-semibold hover:border-accent">
          <LogOut className="size-4" aria-hidden /> {t("লগআউট", "Log out")}
        </button>
      </div>
    </div>
  );
}

/** Sidebar contents, shared by the desktop column and the phone drawer. */
function SideNav({
  me,
  sub,
  pending,
  active,
  onLogout,
  onNavigate,
}: {
  me: Me;
  sub: Subscription | null;
  pending: number;
  active: (href: string) => boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const { lang, setLang, t } = useLang();
  const { theme, cycle } = useTheme();
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeLabel = theme === "light" ? t("সাদা", "Light") : theme === "dark" ? t("কালো", "Dark") : t("অটো", "Auto");

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-2.5 rounded-sm bg-accent" aria-hidden />
          <span className="text-[19px] font-bold tracking-tight">{t("গারান্টি রিলিজ", "Guarantee Release")}</span>
        </div>
        <p className="mt-1 pl-5 text-[13px] text-side-muted">{t("সিকিউরিটি মানির হিসাব", "Security money ledger")}</p>
      </div>

      <div className="px-4">
        <Link
          href="/jobs/new"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-[15.5px] font-bold text-accent-ink hover:brightness-110"
        >
          <Plus className="size-[18px]" aria-hidden /> {t("নতুন জব", "New job")}
        </Link>
      </div>

      <nav className="mt-5 flex flex-col" aria-label={t("মেনু", "Menu")}>
        {NAV.map(({ href, bn, en, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active(href) ? "page" : undefined}
            className={`flex items-center gap-3 border-l-[3px] px-5 py-2.5 text-[15.5px] transition ${
              active(href) ? "border-accent bg-white/[0.06] font-semibold text-side-ink" : "border-transparent text-side-muted hover:bg-white/[0.04] hover:text-side-ink"
            }`}
          >
            <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            {t(bn, en)}
            {href === "/settings" && pending > 0 && (
              <span className="num ml-auto rounded-sm bg-accent px-1.5 text-[12px] font-bold text-accent-ink" title={t("অনুমতির অনুরোধ", "Permission requests")}>
                {pending}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-side-line px-5 py-4 text-[14px]">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-side-line text-[13px]" role="group" aria-label="Language / ভাষা">
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
                className={`px-2.5 py-1 ${lang === l ? "bg-side-ink font-semibold text-side" : "text-side-muted hover:text-side-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={cycle}
            title={t("থিম বদলান", "Change theme")}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-side-line px-2 py-1 text-[13px] text-side-muted hover:text-side-ink"
          >
            <ThemeIcon className="size-3.5" aria-hidden /> {themeLabel}
          </button>
        </div>
        {sub && (
          <p className={`mb-3 text-[12.5px] ${sub.status === "ACTIVE" ? "text-side-muted" : sub.status === "EXPIRING" ? "text-warn" : "text-crit"}`}>
            {sub.status === "EXPIRED"
              ? t("সাবস্ক্রিপশন শেষ", "Subscription expired")
              : t(`সাবস্ক্রিপশন ${fd(sub.endsAt)} পর্যন্ত`, `Subscription until ${fd(sub.endsAt)}`)}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold">{me.name}</p>
            <p className="truncate text-[12.5px] text-side-muted">{ROLE_LABEL[lang][me.role]}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-side-muted hover:bg-white/[0.06] hover:text-side-ink"
          >
            <LogOut className="size-4" aria-hidden /> {t("লগআউট", "Log out")}
          </button>
        </div>
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
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();
  const router = useRouter();

  // Who is logged in and the subscription load together, so the page can start sooner.
  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    api<Subscription>("/subscription").then(setSub).catch(() => {});
  }, [path, tick]);

  useEffect(() => {
    if (me?.role !== "SUPER_ADMIN") return;
    api<OperatorRequest[]>("/operator-requests")
      .then((r) => setPending(r.filter((x) => x.status === "PENDING").length))
      .catch(() => {});
  }, [me, path, tick]);

  useEffect(() => setDrawer(false), [path]);

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

  if (!me) return <Loading full />;
  if (sub && !sub.active && me.role !== "SUPER_ADMIN") return <LockScreen me={me} sub={sub} onLogout={logout} />;

  const showSubBanner = !!sub && me.role !== "OPERATOR" && sub.status !== "ACTIVE";
  const side = <SideNav me={me} sub={sub} pending={pending} active={active} onLogout={logout} onNavigate={() => setDrawer(false)} />;

  return (
    <UserCtx.Provider value={me}>
      <ToastCtx.Provider value={showToast}>
        <RefreshCtx.Provider value={refresh}>
          <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="no-print sticky top-0 hidden h-screen bg-side text-side-ink lg:block">{side}</aside>

            {/* Phone: slim top bar with a menu button that opens the same sidebar */}
            <div className="no-print sticky top-0 z-20 flex items-center gap-3 bg-side px-4 py-3 text-side-ink lg:hidden">
              <button type="button" onClick={() => setDrawer(true)} aria-label={t("মেনু খুলুন", "Open menu")} className="rounded-md p-1.5 hover:bg-white/10">
                <Menu className="size-6" aria-hidden />
              </button>
              <span className="flex items-center gap-2 font-bold">
                <span className="h-5 w-2 rounded-sm bg-accent" aria-hidden />
                {t("গারান্টি রিলিজ", "Guarantee Release")}
              </span>
              <Link href="/jobs/new" className="ml-auto flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-bold text-accent-ink">
                <Plus className="size-4" aria-hidden /> {t("নতুন", "New")}
              </Link>
            </div>
            {drawer && (
              <div className="no-print fixed inset-0 z-40 lg:hidden">
                <button type="button" className="absolute inset-0 bg-black/40" aria-label={t("মেনু বন্ধ করুন", "Close menu")} onClick={() => setDrawer(false)} />
                <div className="relative h-full w-72 bg-side text-side-ink shadow-xl">
                  <button type="button" onClick={() => setDrawer(false)} aria-label={t("মেনু বন্ধ করুন", "Close menu")} className="absolute right-3 top-5 rounded-md p-1 text-side-muted hover:text-side-ink">
                    <X className="size-5" aria-hidden />
                  </button>
                  {side}
                </div>
              </div>
            )}

            <main className="mx-auto w-full min-w-0 max-w-[1180px] px-4 py-6 sm:px-8 lg:py-9">
              {showSubBanner && sub && (
                <div
                  className={`no-print mb-6 flex flex-wrap items-center gap-3 rounded-md border-l-4 px-4 py-3 ${
                    sub.status === "EXPIRED" ? "border-crit bg-crit-bg text-crit" : "border-warn bg-warn-bg text-warn"
                  }`}
                  role="status"
                >
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
                    <Link href="/settings?tab=subscription" className="ml-auto text-sm font-semibold text-ink underline underline-offset-4">
                      {t("সাবস্ক্রিপশন দেখুন", "View subscription")}
                    </Link>
                  )}
                </div>
              )}
              {children}
            </main>
          </div>

          {toast && (
            <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 font-semibold text-surface shadow-lg">
              {toast}
            </div>
          )}
        </RefreshCtx.Provider>
      </ToastCtx.Provider>
    </UserCtx.Provider>
  );
}
