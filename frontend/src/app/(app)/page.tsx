"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarCheck, FilePlus2, FileSpreadsheet } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Dashboard, GroupSum } from "@/lib/types";
import { fd, qs, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Card, Empty, ErrorBox, Guide, Loading, PageHeader } from "@/components/ui";
import { JobTable } from "@/components/job-table";

function Tile({ href, n, label, hint, alert, warn }: { href: string; n: number; label: string; hint: string; alert?: boolean; warn?: boolean }) {
  const red = alert && n > 0;
  const amber = warn && n > 0;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-0.5 rounded-2xl border p-4 shadow-card transition hover:border-accent ${
        red ? "border-crit/60 bg-crit-bg" : amber ? "border-warn/60 bg-warn-bg" : "border-line bg-surface"
      }`}
    >
      <span className={`num text-3xl leading-tight ${red ? "text-crit" : amber ? "text-warn" : ""}`}>{n}</span>
      <span className="font-semibold">{label}</span>
      <span className="text-[12.5px] text-muted">{hint}</span>
    </Link>
  );
}

function GroupList({ items, tone }: { items: GroupSum[]; tone: "good" | "warn" }) {
  const { t } = useLang();
  if (!items.length) return <p className="text-muted">{t("কিছু নেই", "Nothing yet")}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((g) => (
        <li key={g.importerId} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/statement${qs({ importerId: g.importerId })}`} className="hover:underline">
            {g.name} <small className="ml-1 text-muted">{t(`${g.count}টা জব`, `${g.count} jobs`)}</small>
          </Link>
          <span className={`num ${tone === "good" ? "text-good" : "text-warn"}`}>{signed(g.sum)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { t } = useLang();
  const [withReleased, setWithReleased] = useState(false);
  const { data, error, loading, reload } = useApi<Dashboard>(`/reports/dashboard${qs({ includeReleased: withReleased })}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.settings;
  const c = data.counts;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("ড্যাশবোর্ড", "Dashboard")}
        subtitle={t(
          `আজ ${fd(data.today)} · মোট ${c.total}টা জব${c.awaitingDepot ? ` · আরও ${c.awaitingDepot}টা ডিপো রিসিভিংয়ের অপেক্ষায়` : ""}`,
          `Today ${fd(data.today)} · ${c.total} jobs in total${c.awaitingDepot ? ` · ${c.awaitingDepot} more waiting for depot receiving` : ""}`,
        )}
      />

      <Guide
        steps={[
          t(
            "ডেমো ফাইল এলে \"নতুন জব এন্ট্রি\" চাপুন, ডিপো রিসিভিং তারিখ খালি রাখুন। ডিপো রিসিভিং ফাইল এলে \"ডিপো রিসিভিং তারিখ আপডেট\" থেকে তারিখ বসান।",
            "When a demo file arrives, press \"New job entry\" and leave the depot date empty. When the depot receiving file arrives, add the date from \"Update depot receiving date\".",
          ),
          t(
            "রঙিন বক্সগুলো দেখায় কোথায় কাজ বাকি। বক্সে চাপলে ওই জবগুলোর লিস্ট খুলবে।",
            "The coloured boxes show where work is waiting. Press a box to see those jobs.",
          ),
          t(
            `লাল মানে দেরি: সার্ভে ${s.surveyDays} দিন, হিসাব ${s.billDays} দিন, রিলিজ ${s.releaseDays} দিনের বেশি দেরি হলে।`,
            `Red means late: survey after ${s.surveyDays} days, bill after ${s.billDays} days, release after ${s.releaseDays} days.`,
          ),
          t("প্লাস মানে টাকা ফেরত পাবেন, মাইনাস মানে বাড়তি খরচ হয়েছে।", "Plus means money comes back; minus means extra cost."),
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("শর্টকাট", "Shortcuts")}>
        {[
          { href: "/jobs/new", icon: FilePlus2, title: t("নতুন জব এন্ট্রি", "New job entry"), text: t("ডেমো বা ডিপো রিসিভিং ফাইল এলে", "When a demo or depot file arrives"), primary: true },
          {
            href: "/jobs?status=NO_DEPOT",
            icon: CalendarCheck,
            title: t("ডিপো রিসিভিং তারিখ আপডেট", "Update depot receiving date"),
            text: c.awaitingDepot ? t(`${c.awaitingDepot}টা জবে তারিখ বাকি`, `${c.awaitingDepot} jobs need a date`) : t("কোনো জবে বাকি নেই", "Nothing waiting"),
          },
          { href: "/jobs?status=FLAGGED", icon: AlertTriangle, title: t("লাল জবগুলো আপডেট", "Update late jobs"), text: t(`${data.attention.length}টা জবে কাজ বাকি`, `${data.attention.length} jobs need action`) },
          { href: "/statement", icon: FileSpreadsheet, title: t("স্টেটমেন্ট দেখুন", "View statement"), text: t("ইম্পোর্টার ও এজেন্ট অনুযায়ী", "By importer and agent") },
        ].map(({ href, icon: Icon, title, text, primary }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-2xl border p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-md ${
              primary ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
            }`}
          >
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${primary ? "bg-white/15" : "bg-accent-soft text-accent"}`}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{title}</span>
              <span className={`block text-[13px] ${primary ? "opacity-85" : "text-muted"}`}>{text}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={t("সতর্কতা", "Alerts")}>
        <Tile href="/jobs?status=NO_DEPOT" warn n={c.awaitingDepot} label={t("ডিপো রিসিভিং বাকি", "Awaiting depot")} hint={t("ডেমো ফাইল থেকে এন্ট্রি", "Entered from demo file")} />
        <Tile href="/jobs?status=SURVEY_LATE" alert n={c.surveyLate} label={t("সার্ভে লেট", "Survey late")} hint={t(`ডিপোর ${s.surveyDays} দিন পরেও নেই`, `None ${s.surveyDays} days after depot`)} />
        <Tile href="/jobs?status=BILL_LATE" alert n={c.billLate} label={t("হিসাব লেট", "Bill late")} hint={t(`সার্ভের ${s.billDays} দিন পরেও নেই`, `None ${s.billDays} days after survey`)} />
        <Tile href="/jobs?status=OVERDUE" alert n={c.overdue} label={t("ওভারডিউ", "Overdue")} hint={t(`জমার ${s.releaseDays} দিনেও রিলিজ নেই`, `Not released ${s.releaseDays} days after submission`)} />
        <Tile href="/jobs?status=OPEN" n={c.open} label={t("চলমান জব", "Open jobs")} hint={t("রিলিজ বাকি", "Not yet released")} />
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{t("প্লাস / মাইনাস হিসাব", "Plus / minus")}</h2>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={withReleased} onChange={(e) => setWithReleased(e.target.checked)} />
            {t("রিলিজ হওয়া জবও ধরুন", "Include released jobs")}
          </label>
        </div>
        <div className={`mt-3 grid gap-3 sm:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
          <div>
            <p className="text-[13px] text-muted">{t("মোট প্লাস (ফেরত পাবো)", "Total plus (refund due)")}</p>
            <p className="num text-2xl text-good">{signed(data.plusTotal)}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">{t("মোট মাইনাস (বাড়তি খরচ)", "Total minus (extra cost)")}</p>
            <p className="num text-2xl text-warn">{signed(data.minusTotal)}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">{t("নেট", "Net")}</p>
            <p className="num text-2xl">{signed(data.plusTotal + data.minusTotal)}</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-bold text-good">{t("প্লাস · ইম্পোর্টার অনুযায়ী", "Plus · by importer")}</h3>
          <GroupList items={data.plusByImporter} tone="good" />
        </Card>
        <Card>
          <h3 className="mb-2 font-bold text-warn">{t("মাইনাস · ইম্পোর্টার অনুযায়ী", "Minus · by importer")}</h3>
          <GroupList items={data.minusByImporter} tone="warn" />
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{t("এখনই দেখতে হবে", "Needs attention now")}</h2>
          <span className="text-sm text-muted">{t(`${data.attention.length}টা জব লাল`, `${data.attention.length} late jobs`)}</span>
        </div>
        {data.attention.length ? <JobTable jobs={data.attention} /> : <Empty>{t("কোনো জব লাল নেই। সব সময়মতো চলছে।", "No late jobs. Everything is on time.")}</Empty>}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{t("ডিপো রিসিভিং পাওয়া যায়নি", "Depot receiving not yet received")}</h2>
          <span className="text-sm text-muted">
            {t(
              `ডেমো ফাইল থেকে এন্ট্রি · ${data.awaitingDepot.length}টা জব · মোট জবে ধরা হয়নি`,
              `Entered from demo file · ${data.awaitingDepot.length} jobs · not counted in the total`,
            )}
          </span>
        </div>
        {data.awaitingDepot.length ? (
          <JobTable jobs={data.awaitingDepot} />
        ) : (
          <Empty>{t("সব জবে ডিপো রিসিভিং তারিখ দেওয়া আছে।", "Every job has its depot receiving date.")}</Empty>
        )}
      </section>
    </div>
  );
}
