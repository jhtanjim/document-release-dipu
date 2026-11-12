"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { LangSwitch, useLang } from "@/lib/i18n";
import { Button, Field, inputCls } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const { t } = useLang();
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
      <Field label={t("ইমেইল", "Email")} htmlFor="email">
        <input id="email" type="email" autoComplete="username" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t("পাসওয়ার্ড", "Password")} htmlFor="password">
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
      {error && (
        <p className="text-sm font-semibold text-crit" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy} className="py-2.5">
        {t("লগইন করুন", "Log in")}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useLang();
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-md border border-line bg-surface p-6 sm:p-8">
        <div className="mb-5 flex justify-end">
          <LangSwitch />
        </div>
        <div className="mb-6 flex items-center gap-3">
          <span className="h-10 w-3 rounded-sm bg-accent" aria-hidden />
          <div>
            <h1 className="text-xl font-bold">{t("গারান্টি রিলিজ ট্র্যাকার", "Guarantee Release Tracker")}</h1>
            <p className="text-sm text-muted">{t("চালিয়ে যেতে লগইন করুন", "Log in to continue")}</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="mt-6 rounded-lg bg-sunk px-4 py-3 text-[13.5px] leading-relaxed text-muted">
          {t(
            "অফিস থেকে যে ইমেইল আর পাসওয়ার্ড দেওয়া হয়েছে, সেটা দিন। অ্যাকাউন্ট না থাকলে বা পাসওয়ার্ড ভুলে গেলে আপনার অ্যাডমিনকে বলুন, তিনি নতুন পাসওয়ার্ড দিয়ে দেবেন।",
            "Use the email and password your office gave you. If you have no account or forgot your password, ask your admin to set a new one.",
          )}
        </div>
      </div>
    </div>
  );
}
