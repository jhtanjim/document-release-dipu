"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarCheck, FilePlus2, FileSpreadsheet } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Dashboard, GroupSum } from "@/lib/types";
import { fd, qs, signed } from "@/lib/format";
import { Card, Empty, ErrorBox, Guide, Loading, PageHeader } from "@/components/ui";
import { JobTable } from "@/components/job-table";

function Tile({
  href,
  n,
  label,
  hint,
  alert,
  warn,
}: {
  href: string;
  n: number;
  label: string;
  hint: string;
  alert?: boolean;
  warn?: boolean;
}) {
  const red = alert && n > 0;
  const amber = warn && n > 0;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-0.5 rounded-xl border p-4 transition hover:border-accent ${
        red ? "border-crit bg-crit-bg" : amber ? "border-warn/60 bg-warn-bg" : "border-line bg-surface"
      }`}
    >
      <span className={`num text-3xl leading-tight ${red ? "text-crit" : amber ? "text-warn" : ""}`}>{n}</span>
      <span className="font-semibold">{label}</span>
      <span className="text-[12.5px] text-muted">{hint}</span>
    </Link>
  );
}

function GroupList({ items, tone }: { items: GroupSum[]; tone: "good" | "warn" }) {
  if (!items.length) return <p className="text-muted">কিছু নেই</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((g) => (
        <li key={g.importerId} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/statement${qs({ importerId: g.importerId })}`} className="hover:underline">
            {g.name} <small className="ml-1 text-muted">{g.count}টা জব</small>
          </Link>
          <span className={`num ${tone === "good" ? "text-good" : "text-warn"}`}>{signed(g.sum)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const [withReleased, setWithReleased] = useState(false);
  const { data, error, loading, reload } = useApi<Dashboard>(`/reports/dashboard${qs({ includeReleased: withReleased })}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.settings;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ড্যাশবোর্ড"
        subtitle={`আজ ${fd(data.today)} · মোট ${data.counts.total}টা জব (ডিপো রিসিভিং পাওয়া)${
          data.counts.awaitingDepot ? ` · আরও ${data.counts.awaitingDepot}টা ডিপো রিসিভিংয়ের অপেক্ষায়` : ""
        }`}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="শর্টকাট">
        {[
          { href: "/jobs/new", icon: FilePlus2, title: "নতুন জব এন্ট্রি", text: "ডেমো বা ডিপো রিসিভিং ফাইল এলে", primary: true },
          {
            href: "/jobs?status=NO_DEPOT",
            icon: CalendarCheck,
            title: "ডিপো রিসিভিং তারিখ আপডেট",
            text: data.counts.awaitingDepot ? `${data.counts.awaitingDepot}টা জবে তারিখ বাকি` : "কোনো জবে বাকি নেই",
          },
          { href: "/jobs?status=FLAGGED", icon: AlertTriangle, title: "লাল জবগুলো আপডেট", text: `${data.attention.length}টা জবে কাজ বাকি` },
          { href: "/statement", icon: FileSpreadsheet, title: "স্টেটমেন্ট দেখুন", text: "ইম্পোর্টার ও এজেন্ট অনুযায়ী" },
        ].map(({ href, icon: Icon, title, text, primary }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
              primary ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
            }`}
          >
            <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${primary ? "bg-white/15" : "bg-accent-soft text-accent"}`}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{title}</span>
              <span className={`block text-[13px] ${primary ? "opacity-85" : "text-muted"}`}>{text}</span>
            </span>
          </Link>
        ))}
      </section>

      <Guide
        id="dashboard-v2"
        steps={[
          "ডেমো ফাইল এলে \"নতুন জব এন্ট্রি\" দিয়ে জব খুলুন, ডিপো রিসিভিং তারিখ খালি রাখুন। পরে ডিপো রিসিভিং ফাইল এলে \"ডিপো রিসিভিং তারিখ আপডেট\" থেকে তারিখ বসান।",
          "ডিপো রিসিভিং তারিখ দেওয়ার পর থেকেই জবটা \"মোট জব\"-এ গোনা হয়। তার আগ পর্যন্ত নিচের \"ডিপো রিসিভিং পাওয়া যায়নি\" ঘরে থাকে।",
          "উপরের লাল বক্সগুলো দেখায় কয়টা জব দেরি হচ্ছে। বক্সে চাপলে ওই জবগুলোর লিস্ট খুলবে।",
          `সার্ভে লেট: ডিপো রিসিভিংয়ের ${s.surveyDays} দিনের বেশি পরেও সার্ভে আসেনি। হিসাব লেট: সার্ভের ${s.billDays} দিন বা বেশি পরেও এজেন্টের হিসাব আসেনি। ওভারডিউ: এজেন্টে জমার ${s.releaseDays} দিনের বেশি পরেও রিলিজ হয়নি।`,
          "প্লাস মানে খরচ সিকিউরিটির চেয়ে কম, টাকা ফেরত পাবেন। মাইনাস মানে খরচ বেশি, বাড়তি দিতে হয়েছে।",
          "নিচের \"এখনই দেখতে হবে\" লিস্টে সবচেয়ে বেশি দেরির জব আগে আসে। জবে চাপ দিয়ে তারিখ আপডেট করুন।",
        ]}
        note={"নতুন ফাইল এলে বাম পাশের \"নতুন জব\" বাটন চাপুন।"}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="সতর্কতা">
        <Tile href="/jobs?status=NO_DEPOT" warn n={data.counts.awaitingDepot} label="ডিপো রিসিভিং বাকি" hint="ডেমো ফাইল থেকে এন্ট্রি, তারিখ এখনো দেওয়া হয়নি" />
        <Tile href="/jobs?status=SURVEY_LATE" alert n={data.counts.surveyLate} label="সার্ভে লেট" hint={`ডিপোর ${s.surveyDays} দিনের বেশি পরেও সার্ভে নেই`} />
        <Tile href="/jobs?status=BILL_LATE" alert n={data.counts.billLate} label="হিসাব লেট" hint={`সার্ভের ${s.billDays} দিন পরেও হিসাব নেই`} />
        <Tile href="/jobs?status=OVERDUE" alert n={data.counts.overdue} label="ওভারডিউ" hint={`জমার ${s.releaseDays} দিনেও রিলিজ হয়নি`} />
        <Tile href="/jobs?status=OPEN" n={data.counts.open} label="চলমান জব" hint="ডিপো রিসিভিং পাওয়া, রিলিজ বাকি" />
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">প্লাস / মাইনাস হিসাব</h2>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={withReleased} onChange={(e) => setWithReleased(e.target.checked)} />
            রিলিজ হওয়া জবও ধরুন
          </label>
        </div>
        <div className={`mt-3 grid gap-3 sm:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
          <div>
            <p className="text-[13px] text-muted">মোট প্লাস (ফেরত পাবো)</p>
            <p className="num text-2xl text-good">{signed(data.plusTotal)}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">মোট মাইনাস (বাড়তি খরচ)</p>
            <p className="num text-2xl text-warn">{signed(data.minusTotal)}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">নেট</p>
            <p className="num text-2xl">{signed(data.plusTotal + data.minusTotal)}</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-bold text-good">প্লাস · ইম্পোর্টার অনুযায়ী</h3>
          <GroupList items={data.plusByImporter} tone="good" />
        </Card>
        <Card>
          <h3 className="mb-2 font-bold text-warn">মাইনাস · ইম্পোর্টার অনুযায়ী</h3>
          <GroupList items={data.minusByImporter} tone="warn" />
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">এখনই দেখতে হবে</h2>
          <span className="text-sm text-muted">{data.attention.length}টা জব লাল</span>
        </div>
        {data.attention.length ? <JobTable jobs={data.attention} /> : <Empty>কোনো জব লাল নেই। সব সময়মতো চলছে।</Empty>}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">ডিপো রিসিভিং পাওয়া যায়নি</h2>
          <span className="text-sm text-muted">
            ডেমো ফাইল থেকে এন্ট্রি · {data.awaitingDepot.length}টা জব · মোট জবের হিসাবে ধরা হয়নি
          </span>
        </div>
        {data.awaitingDepot.length ? (
          <JobTable jobs={data.awaitingDepot} />
        ) : (
          <Empty>সব জবে ডিপো রিসিভিং তারিখ দেওয়া আছে।</Empty>
        )}
      </section>
    </div>
  );
}
