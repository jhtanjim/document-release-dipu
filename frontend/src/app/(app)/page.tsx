"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import { fd, qs, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { ErrorBox, Guide, Loading, PageHeader } from "@/components/ui";

export default function OverviewPage() {
  const { t } = useLang();
  const [withReleased, setWithReleased] = useState(false);
  const { data, error, loading, reload } = useApi<Dashboard>(`/reports/dashboard${qs({ includeReleased: withReleased })}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.settings;
  const c = data.counts;

  const tasks = [
    {
      href: "/jobs?status=NO_DEPOT",
      n: c.awaitingDepot,
      late: false,
      title: t("ডিপো রিসিভিং তারিখ দিতে হবে", "Depot receiving date needed"),
      text: t("ডেমো ফাইল থেকে এন্ট্রি করা জব", "Jobs entered from a demo file"),
    },
    {
      href: "/jobs?status=SURVEY_LATE",
      n: c.surveyLate,
      late: true,
      title: t("সার্ভে রিপোর্ট আসেনি", "Survey report not received"),
      text: t(`ডিপো রিসিভিংয়ের ${s.surveyDays} দিনের বেশি হয়ে গেছে`, `More than ${s.surveyDays} days after depot receiving`),
    },
    {
      href: "/jobs?status=BILL_LATE",
      n: c.billLate,
      late: true,
      title: t("এজেন্টের হিসাব আসেনি", "Agent's bill not received"),
      text: t(`সার্ভে রিপোর্টের ${s.billDays} দিন বা বেশি হয়ে গেছে`, `${s.billDays} days or more after the survey report`),
    },
    {
      href: "/jobs?status=OVERDUE",
      n: c.overdue,
      late: true,
      title: t("রিলিজ হয়নি", "Not released"),
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

  const figures = [
    { href: "/jobs?status=OPEN", label: t("চলমান জব", "Open jobs"), value: String(c.open), cls: "" },
    { href: "/statement", label: t("ফেরত পাবো", "Money back"), value: signed(data.plusTotal), cls: "text-good" },
    { href: "/statement", label: t("বাড়তি খরচ", "Extra cost"), value: signed(data.minusTotal), cls: "text-warn" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={t("আজকের অবস্থা", "Overview")}
        subtitle={t(
          `${fd(data.today)} · মোট ${c.total}টা জব${c.awaitingDepot ? `, আরও ${c.awaitingDepot}টা ডিপো রিসিভিংয়ের অপেক্ষায়` : ""}`,
          `${fd(data.today)} · ${c.total} jobs${c.awaitingDepot ? `, ${c.awaitingDepot} more waiting for depot receiving` : ""}`,
        )}
      />

      {/* Three totals in one ruled box */}
      <section className={`grid rounded-md border border-line bg-surface sm:grid-cols-3 ${loading ? "opacity-60" : ""}`} aria-label={t("সারাংশ", "Totals")}>
        {figures.map((f, i) => (
          <Link key={f.label} href={f.href} className={`px-6 py-5 hover:bg-sunk ${i ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
            <span className="block text-[14.5px] text-muted">{f.label}</span>
            <span className={`num mt-1 block text-[32px] font-bold leading-none ${f.cls}`}>{f.value}</span>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-[19px] font-bold">{t("আজকের কাজ", "Today's work")}</h2>
        {tasks.length ? (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {tasks.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="group flex items-center gap-5 px-5 py-4 hover:bg-sunk">
                  <span className={`num w-12 shrink-0 text-right text-[28px] font-bold leading-none ${x.late ? "text-crit" : "text-warn"}`}>{x.n}</span>
                  <span className="min-w-0 flex-1 border-l border-line pl-5">
                    <span className="block text-[16px] font-semibold">{x.title}</span>
                    <span className="block text-[14px] text-muted">{x.text}</span>
                  </span>
                  <span className="hidden text-[14px] font-semibold text-muted group-hover:text-ink sm:block">{t("দেখুন →", "Open →")}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-line border-l-4 border-l-good bg-surface px-5 py-4 font-semibold text-good">
            {t("সব কাজ সময়মতো চলছে। এখন কিছু বাকি নেই।", "Everything is on time. Nothing is waiting.")}
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[19px] font-bold">{t("ইম্পোর্টার অনুযায়ী হিসাব", "By importer")}</h2>
          <label className="flex items-center gap-2 text-[14px] text-muted">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={withReleased} onChange={(e) => setWithReleased(e.target.checked)} />
            {t("রিলিজ হওয়া জবও ধরুন", "Include released jobs")}
          </label>
        </div>
        {importerRows.length ? (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-line bg-sunk text-left text-[13.5px] text-muted">
                  <th className="px-5 py-2.5 font-semibold">{t("ইম্পোর্টার", "Importer")}</th>
                  <th className="px-5 py-2.5 text-right font-semibold">{t("ফেরত পাবো", "Money back")}</th>
                  <th className="px-5 py-2.5 text-right font-semibold">{t("বাড়তি খরচ", "Extra cost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {importerRows.map(([id, r]) => (
                  <tr key={id} className="hover:bg-sunk">
                    <td className="px-5 py-3">
                      <Link href={`/statement${qs({ importerId: id })}`} className="font-semibold underline-offset-4 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="num px-5 py-3 text-right font-semibold text-good">{r.plus ? signed(r.plus) : "—"}</td>
                    <td className="num px-5 py-3 text-right font-semibold text-warn">{r.minus ? signed(r.minus) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md border border-line bg-surface px-5 py-4 text-muted">{t("এখনো কোনো এজেন্টের হিসাব আসেনি।", "No agent bills yet.")}</p>
        )}
      </section>

      <Guide
        steps={[
          t("নতুন ফাইল এলে বাম পাশের \"নতুন জব\" চাপুন।", "When a new file arrives, press \"New job\" on the left."),
          t("\"আজকের কাজ\"-এর লাইনে চাপ দিয়ে জবগুলো খুলুন আর তারিখ আপডেট করুন।", "Open a line in \"Today's work\" and update the dates of those jobs."),
          t("সবুজ = টাকা ফেরত পাবেন, কমলা = বাড়তি খরচ, লাল = দেরি হচ্ছে।", "Green = money back, orange = extra cost, red = late."),
        ]}
      />
    </div>
  );
}
