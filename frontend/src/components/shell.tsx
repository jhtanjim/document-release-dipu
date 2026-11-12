"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  Ship,
  Sun,
} from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_LABEL, type Me, type OperatorRequest, type Subscription } from "@/lib/types";
import { fd } from "@/lib/format";
import { Loading } from "./ui";

const UserCtx = createContext<Me | null>(null);
export const useMe = () => useContext(UserCtx);

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/** Lets a page tell the shell that the subscription or requests changed. */
const RefreshCtx = createContext<() => void>(() => {});
export const useShellRefresh = () => useContext(RefreshCtx);

const NAV = [
  { href: "/", label: "ড্যাশবোর্ড", hint: "আজকের অবস্থা", icon: BarChart3 },
  { href: "/jobs", label: "সব জব", hint: "খুঁজুন ও আপডেট করুন", icon: ClipboardList },
  { href: "/statement", label: "স্টেটমেন্ট", hint: "ইম্পোর্টার ও এজেন্ট অনুযায়ী", icon: FileSpreadsheet },
  { href: "/settings", label: "সেটিংস", hint: "নিয়ম, লিস্ট, অ্যাকাউন্ট", icon: Settings },
];

type ThemeChoice = "system" | "light" | "dark";
const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "সাদা", icon: Sun },
  { value: "dark", label: "কালো", icon: Moon },
  { value: "system", label: "অটো", icon: Monitor },
];

function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const choose = (t: ThemeChoice) => {
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem("theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("theme", t);
        document.documentElement.dataset.theme = t;
      }
    } catch {}
  };
  return (
    <div className="flex rounded-full border border-line bg-sunk p-0.5" role="group" aria-label="থিম">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={theme === value}
          title={`${label} থিম`}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition ${
            theme === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
          }`}
        >
          <Icon className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function LockScreen({ me, sub, onLogout }: { me: Me; sub: Subscription; onLogout: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-card">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-crit-bg text-crit">
          <Lock className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">সাবস্ক্রিপশনের মেয়াদ শেষ</h1>
        <p className="mt-2 text-muted">
          {fd(sub.endsAt)} তারিখে সফটওয়্যারের মেয়াদ শেষ হয়েছে। আবার চালু করতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন। আপনার সব ডেটা নিরাপদে সেভ আছে।
        </p>
        <p className="mt-4 text-sm text-muted">
          লগইন করা আছেন: <b className="text-ink">{me.name}</b>
        </p>
        <button onClick={onLogout} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 font-semibold hover:border-accent">
          <LogOut className="size-4" aria-hidden /> লগআউট
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
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

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (!me || !sub) return <div className="mx-auto max-w-6xl px-4"><Loading /></div>;
  if (!sub.active && me.role !== "SUPER_ADMIN") return <LockScreen me={me} sub={sub} onLogout={logout} />;

  const today = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const showSubBanner = me.role !== "OPERATOR" && sub.status !== "ACTIVE";

  return (
    <UserCtx.Provider value={me}>
      <ToastCtx.Provider value={showToast}>
        <RefreshCtx.Provider value={refresh}>
          <div className="min-h-screen lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
            {/* Sidebar (desktop) / top menu (phone) */}
            <aside className="no-print sticky top-0 z-20 border-b border-line bg-surface lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-5">
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink shadow-card">
                  <Ship className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 leading-tight">
                  <b className="block text-[16.5px]">গারান্টি রিলিজ</b>
                  <small className="text-muted">জব ও সিকিউরিটি মানি ট্র্যাকার</small>
                </div>
                <div className="ml-auto lg:hidden">
                  <ThemeSwitch />
                </div>
              </div>
              <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:gap-1.5 lg:px-3" aria-label="মেনু">
                {NAV.map(({ href, label, hint, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active(href) ? "page" : undefined}
                    className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 lg:py-2.5 ${
                      active(href) ? "bg-accent text-accent-ink shadow-card" : "text-muted hover:bg-sunk hover:text-ink"
                    }`}
                  >
                    <Icon className="size-[19px] shrink-0" aria-hidden />
                    <span className="min-w-0 leading-tight">
                      <span className="block text-[15px] font-semibold">{label}</span>
                      <span className={`hidden text-[12px] lg:block ${active(href) ? "opacity-85" : "text-muted"}`}>{hint}</span>
                    </span>
                    {href === "/settings" && pending > 0 && (
                      <span className="num ml-auto grid min-w-5 place-items-center rounded-full bg-crit px-1.5 text-[11px] font-bold text-white" title="অনুমতির অনুরোধ">
                        {pending}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
              <div className="hidden px-3 pt-3 lg:block">
                <Link
                  href="/jobs/new"
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3 font-semibold text-accent-ink shadow-card hover:brightness-110"
                >
                  <Plus className="size-5" aria-hidden /> নতুন জব এন্ট্রি
                </Link>
              </div>

              <div className="mt-auto hidden flex-col gap-3 border-t border-line p-4 lg:flex">
                <Link
                  href={me.role === "SUPER_ADMIN" ? "/settings?tab=subscription" : "#"}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] ${
                    sub.status === "ACTIVE" ? "bg-good-bg text-good" : sub.status === "EXPIRING" ? "bg-warn-bg text-warn" : "bg-crit-bg text-crit"
                  }`}
                >
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                  <span className="leading-tight">
                    <b className="block">{sub.status === "EXPIRED" ? "সাবস্ক্রিপশন শেষ" : `সাবস্ক্রিপশন চালু · ${sub.daysLeft} দিন বাকি`}</b>
                    <span className="opacity-85">
                      {fd(sub.endsAt)} পর্যন্ত{sub.autoRenew ? " · অটো-রিনিউ চালু" : ""}
                    </span>
                  </span>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent">{me.name.slice(0, 1)}</span>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold">{me.name}</p>
                    <p className="truncate text-[12.5px] text-muted">{ROLE_LABEL[me.role]}</p>
                  </div>
                  <button onClick={logout} className="ml-auto rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink" title="লগআউট" aria-label="লগআউট">
                    <LogOut className="size-[18px]" aria-hidden />
                  </button>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              {/* Top bar (desktop) */}
              <header className="no-print sticky top-0 z-10 hidden items-center gap-4 border-b border-line bg-bg/85 px-8 py-3 backdrop-blur lg:flex">
                <p className="text-[14.5px]">
                  স্বাগতম, <b>{me.name}</b> <span className="text-muted">· {today}</span>
                </p>
                <div className="ml-auto flex items-center gap-3">
                  <ThemeSwitch />
                </div>
              </header>

              <main className="mx-auto w-full min-w-0 max-w-[1240px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                {showSubBanner && (
                  <div
                    className={`no-print mb-5 flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${
                      sub.status === "EXPIRED" ? "border-crit/50 bg-crit-bg text-crit" : "border-warn/50 bg-warn-bg text-warn"
                    }`}
                    role="status"
                  >
                    <CalendarClock className="size-5 shrink-0" aria-hidden />
                    <p className="font-semibold">
                      {sub.status === "EXPIRED"
                        ? `সাবস্ক্রিপশনের মেয়াদ ${fd(sub.endsAt)} তারিখে শেষ হয়েছে। অন্যরা এখন লগইন করে কাজ করতে পারছেন না।`
                        : `সাবস্ক্রিপশন ${sub.daysLeft} দিন পর (${fd(sub.endsAt)}) শেষ হবে।${sub.autoRenew ? " অটো-রিনিউ চালু আছে, নিজে থেকে বাড়বে।" : " অটো-রিনিউ বন্ধ।"}`}
                    </p>
                    {me.role === "SUPER_ADMIN" && (
                      <Link href="/settings?tab=subscription" className="ml-auto rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-ink">
                        সাবস্ক্রিপশন দেখুন
                      </Link>
                    )}
                  </div>
                )}
                {children}
              </main>
            </div>
          </div>

          <Link
            href="/jobs/new"
            className="no-print fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink shadow-lg lg:hidden"
          >
            <Plus className="size-5" aria-hidden /> নতুন জব
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
