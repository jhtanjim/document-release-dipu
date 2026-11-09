"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ship } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, inputCls } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { json: { email, password } });
      router.replace(next.startsWith("/") ? next : "/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="ইমেইল" htmlFor="email">
        <input id="email" type="email" autoComplete="username" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="পাসওয়ার্ড" htmlFor="password">
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && <p className="text-sm font-semibold text-crit" role="alert">{error}</p>}
      <Button type="submit" variant="primary" loading={busy} className="py-2.5">
        লগইন করুন
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-ink">
            <Ship className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold">গারান্টি রিলিজ ট্র্যাকার</h1>
            <p className="text-sm text-muted">চালিয়ে যেতে লগইন করুন</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-[13px] text-muted">অ্যাকাউন্ট না থাকলে অ্যাডমিনের কাছে চান।</p>
      </div>
    </div>
  );
}
