"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarCheck, CheckCircle2, ChevronRight, ClipboardList, FileSearch, Plus, Receipt, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import { fd, qs, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Card, ErrorBox, Guide, Loading } from "@/components/ui";
import { useMe } from "@/components/shell";

function Stat({ href, icon: Icon, label, value, tone }: { href: string; icon: LucideIcon; label: string; value: string; tone: "accent" | "good" | "warn" }) {
  const toneCls = { accent: "bg-accent-soft text-accent", good: "bg-good-bg text-good", warn: "bg-warn-bg text-warn" }[tone];
  return (
    <Link href={href} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition hover:border-accent/50">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneCls}`}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] text-muted">{label}</span>
        <span className={`num block text-[28px] font-bold leading-tight ${tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : ""}`}>{value}</span>
      </span>
    </Link>
  );
}

function TaskRow({ href, icon: Icon, title, text, n, tone }: { href: string; icon: LucideIcon; title: string; text: string; n: number; tone: "warn" | "crit" }) {
  const { t } = useLang();
  const cls = tone === "crit" ? "bg-crit-bg text-crit" : "bg-warn-bg text-warn";
  return (
    <li>
      <Link href={href} className="flex items-center gap-4 px-5 py-4 transition hover:bg-sunk">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${cls}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-[14px] text-muted">{text}</span>
        </span>
        <span className={`num rounded-full px-3 py-1 text-[15px] font-bold ${cls}`}>{t(`${n}টা`, `${n}`)}</span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default function HomePage() {
  const { t } = useLang();
  const me = useMe();
  const [withReleased, setWithReleased] = useState(false);
  const { data, error, loading, reload } = useApi<Dashboard>(`/reports/dashboard${qs({ includeReleased: withReleased })}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.settings;
  const c = data.counts;

  const tasks = [
    {
      href: "/jobs?status=NO_DEPOT",
      icon: CalendarCheck,
      n: c.awaitingDepot,
      tone: "warn" as const,
      title: t("ডিপো রিসিভিং তারিখ দিতে হবে", "Add the depot receiving date"),
      text: t("ডেমো ফাইল থেকে এন্ট্রি করা জব", "Jobs entered from a demo file"),
    },
    {
      href: "/jobs?status=SURVEY_LATE",
      icon: FileSearch,
      n: c.surveyLate,
      tone: "crit" as const,
      title: t("সার্ভে রিপোর্ট আসেনি", "Survey report not received"),
      text: t(`ডিপো রিসিভিংয়ের ${s.surveyDays} দিনের বেশি হয়ে গেছে`, `More than ${s.surveyDays} days after depot receiving`),
    },
    {
      href: "/jobs?status=BILL_LATE",
      icon: Receipt,
      n: c.billLate,
      tone: "crit" as const,
      title: t("এজেন্টের হিসাব আসেনি", "Agent's bill not received"),
      text: t(`সার্ভে রিপোর্টের ${s.billDays} দিন বা বেশি হয়ে গেছে`, `${s.billDays} days or more after the survey report`),
    },
    {
      href: "/jobs?status=OVERDUE",
      icon: Timer,
      n: c.overdue,
      tone: "crit" as const,
      title: t("রিলিজ হয়নি (ওভারডিউ)", "Not released (overdue)"),
      text: t(`এজেন্টকে জমার ${s.releaseDays} দিনের বেশি হয়ে গেছে`, `More than ${s.releaseDays} days after submission to the agent`),
    },
  ].filter((x) => x.n > 0);

  // Plus and minus side by side for each importer.
  const byImporter = new Map<number, { name: string; plus: number; minus: number }>();
  for (const g of data.plusByImporter) byImporter.set(g.importerId, { name: g.name, plus: g.sum, minus: 0 });
  for (const g of data.minusByImporter) {
    const row = byImporter.get(g.importerId) ?? { name: g.name, plus: 0, minus: 0 };
    row.minus = g.sum;
    byImporter.set(g.importerId, row);
  }
  const importerRows = [...byImporter.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold sm:text-[30px]">{t(`স্বাগতম, ${me?.name ?? ""}`, `Welcome, ${me?.name ?? ""}`)}</h1>
          <p className="mt-1 text-muted">
            {t(`আজ ${fd(data.today)} · মোট ${c.total}টা জব`, `Today ${fd(data.today)} · ${c.total} jobs in total`)}
          </p>
        </div>
        <Link href="/jobs/new" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[16px] font-bold text-accent-ink shadow-card hover:brightness-110">
          <Plus className="size-5" aria-hidden /> {t("নতুন জব এন্ট্রি", "New job entry")}
        </Link>
      </div>

      <Guide
        steps={[
          t("নতুন ফাইল এলে \"নতুন জব এন্ট্রি\" চাপুন।", "When a new file arrives, press \"New job entry\"."),
          t("\"আজকের কাজ\"-এ যা আছে, সেগুলোতে চাপ দিয়ে তারিখ আপডেট করুন।", "Open each item in \"Today's work\" and update its dates."),
          t("সবুজ = টাকা ফেরত পাবেন, কমলা = বাড়তি খরচ।", "Green = money back, orange = extra cost."),
        ]}
      />

      <section className={`grid gap-4 sm:grid-cols-3 ${loading ? "opacity-60" : ""}`} aria-label={t("সারাংশ", "Summary")}>
        <Stat href="/jobs?status=OPEN" icon={ClipboardList} tone="accent" label={t("চলমান জব", "Open jobs")} value={String(c.open)} />
        <Stat href="/statement" icon={ArrowDownLeft} tone="good" label={t("ফেরত পাবো", "Money back")} value={signed(data.plusTotal)} />
        <Stat href="/statement" icon={ArrowUpRight} tone="warn" label={t("বাড়তি খরচ", "Extra cost")} value={signed(data.minusTotal)} />
      </section>

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-bold">{t("আজকের কাজ", "Today's work")}</h2>
          {tasks.length > 0 && (
            <span className="text-[14px] text-muted">{t(`${tasks.reduce((a, x) => a + x.n, 0)}টা জবে কাজ বাকি`, `${tasks.reduce((a, x) => a + x.n, 0)} jobs need action`)}</span>
          )}
        </div>
        {tasks.length ? (
          <ul className="divide-y divide-line">
            {tasks.map((x) => (
              <TaskRow key={x.href} {...x} />
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-3 px-5 py-6 text-good">
            <CheckCircle2 className="size-6" aria-hidden />
            <span className="font-semibold">{t("সব কাজ সময়মতো চলছে। এখন কিছু বাকি নেই।", "Everything is on time. Nothing waiting right now.")}</span>
          </p>
        )}
      </Card>

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-bold">{t("ইম্পোর্টার অনুযায়ী হিসাব", "By importer")}</h2>
          <label className="flex items-center gap-2 text-[14px] text-muted">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={withReleased} onChange={(e) => setWithReleased(e.target.checked)} />
            {t("রিলিজ হওয়া জবও ধরুন", "Include released jobs")}
          </label>
        </div>
        {importerRows.length ? (
          <table className="w-full text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="px-5 py-2.5 font-semibold">{t("ইম্পোর্টার", "Importer")}</th>
                <th className="px-5 py-2.5 text-right font-semibold">{t("ফেরত পাবো", "Money back")}</th>
                <th className="px-5 py-2.5 text-right font-semibold">{t("বাড়তি খরচ", "Extra cost")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {importerRows.map(([id, r]) => (
                <tr key={id} className="hover:bg-sunk">
                  <td className="px-5 py-3">
                    <Link href={`/statement${qs({ importerId: id })}`} className="font-semibold hover:text-accent">
                      {r.name}
                    </Link>
                  </td>
                  <td className="num px-5 py-3 text-right font-semibold text-good">{r.plus ? signed(r.plus) : "—"}</td>
                  <td className="num px-5 py-3 text-right font-semibold text-warn">{r.minus ? signed(r.minus) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-muted">{t("এখনো কোনো এজেন্টের হিসাব আসেনি।", "No agent bills yet.")}</p>
        )}
      </Card>

      {c.awaitingDepot + c.surveyLate + c.billLate + c.overdue === 0 && data.attention.length === 0 ? null : (
        <p className="flex items-center gap-2 text-[14px] text-muted">
          <AlertTriangle className="size-4" aria-hidden />
          {t("লাল বা হলুদ লাইনে চাপ দিলে ওই জবগুলোর লিস্ট খুলবে।", "Press a red or yellow line to see those jobs.")}
        </p>
      )}
    </div>
  );
}
