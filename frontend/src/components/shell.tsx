"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { BarChart3, ClipboardList, FileSpreadsheet, LogOut, Plus, Settings, Ship } from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_LABEL, type Me } from "@/lib/types";
import { Loading } from "./ui";

const UserCtx = createContext<Me | null>(null);
export const useMe = () => useContext(UserCtx);

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const NAV = [
  { href: "/", label: "ড্যাশবোর্ড", icon: BarChart3 },
  { href: "/jobs", label: "সব জব", icon: ClipboardList },
  { href: "/statement", label: "স্টেটমেন্ট", icon: FileSpreadsheet },
  { href: "/settings", label: "সেটিংস", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => router.replace("/login"));
  }, [router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (!me) return <div className="mx-auto max-w-6xl px-4"><Loading /></div>;

  return (
    <UserCtx.Provider value={me}>
      <ToastCtx.Provider value={showToast}>
        <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="no-print sticky top-0 z-20 border-b border-line bg-surface lg:h-screen lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-5">
              <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-ink">
                <Ship className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 leading-tight">
                <b className="block text-[16px]">গারান্টি রিলিজ</b>
                <small className="text-muted">জব ট্র্যাকার</small>
              </div>
              <button
                onClick={logout}
                className="ml-auto rounded-lg p-2 text-muted hover:bg-sunk lg:hidden"
                aria-label="লগআউট"
                title="লগআউট"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3" aria-label="মেনু">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-semibold ${
                    active(href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunk hover:text-ink"
                  }`}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="hidden px-3 pt-4 lg:block">
              <Link
                href="/jobs/new"
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 font-semibold text-accent-ink hover:brightness-110"
              >
                <Plus className="size-4" aria-hidden /> নতুন জব
              </Link>
            </div>
            <div className="absolute inset-x-0 bottom-0 hidden border-t border-line p-4 lg:block">
              <p className="truncate font-semibold">{me.name}</p>
              <p className="truncate text-[13px] text-muted">
                {ROLE_LABEL[me.role]} · {me.email}
              </p>
              <button onClick={logout} className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
                <LogOut className="size-4" aria-hidden /> লগআউট
              </button>
            </div>
          </aside>

          <main className="mx-auto w-full min-w-0 max-w-[1240px] px-4 py-5 sm:px-6 lg:py-8">{children}</main>
        </div>

        <Link
          href="/jobs/new"
          className="no-print fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink shadow-lg lg:hidden"
        >
          <Plus className="size-5" aria-hidden /> নতুন জব
        </Link>

        {toast && (
          <div
            role="status"
            className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 font-semibold text-surface shadow-lg"
          >
            {toast}
          </div>
        )}
      </ToastCtx.Provider>
    </UserCtx.Provider>
  );
}
