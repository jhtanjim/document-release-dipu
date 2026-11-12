"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Agent, Importer, JobList } from "@/lib/types";
import { qs } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Empty, ErrorBox, Guide, Loading, PageHeader, Segmented, inputCls } from "@/components/ui";
import { JobTable } from "@/components/job-table";

function JobsInner() {
  const { t } = useLang();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const importerId = sp.get("importerId") ?? "";
  const agentId = sp.get("agentId") ?? "";
  const status = sp.get("status") ?? "";
  const search = sp.get("search") ?? "";
  const [text, setText] = useState(search);

  const set = (patch: Record<string, string>) =>
    router.replace(`${pathname}${qs({ importerId, agentId, status, search, ...patch })}`, { scroll: false });

  useEffect(() => {
    const timer = window.setTimeout(() => text !== search && set({ search: text.trim() }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const importers = useApi<Importer[]>("/importers");
  const agents = useApi<Agent[]>("/agents");
  const jobs = useApi<JobList>(`/jobs${qs({ importerId, agentId, status, search })}`);

  const STATUS = [
    { value: "", label: t("সব", "All") },
    { value: "FLAGGED", label: t("লাল মার্ক", "Late") },
    { value: "SURVEY_LATE", label: t("সার্ভে লেট", "Survey late") },
    { value: "BILL_LATE", label: t("হিসাব লেট", "Bill late") },
    { value: "OVERDUE", label: t("ওভারডিউ", "Overdue") },
    { value: "NO_DEPOT", label: t("ডিপো রিসিভিং বাকি", "Awaiting depot") },
    { value: "PENDING_BILL", label: t("হিসাব আসেনি", "No bill yet") },
    { value: "OPEN", label: t("চলমান", "Open") },
    { value: "RELEASED", label: t("রিলিজড", "Released") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("সব জব", "All jobs")}
        subtitle={
          jobs.data
            ? t(`${jobs.data.items.length}টা জব · লাইনে ক্লিক করে খুলুন বা আপডেট করুন`, `${jobs.data.items.length} jobs · click a row to open or update it`)
            : undefined
        }
        actions={
          <Link href="/jobs/new" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            <Plus className="size-4" aria-hidden /> {t("নতুন জব", "New job")}
          </Link>
        }
      />

      <Guide
        steps={[
          t("উপরের ঘর থেকে ইম্পোর্টার বা শিপিং এজেন্ট বাছাই করলে শুধু তাদের জব দেখাবে।", "Pick an importer or shipping agent to see only their jobs."),
          t("জব নং বা C নং লিখে খুঁজুন, যেমন 254777।", "Search by job number or C number, e.g. 254777."),
          t("\"অবস্থা\" বাটন দিয়ে শুধু লাল, হিসাব আসেনি, চলমান বা রিলিজড জব দেখুন।", "Use the \"Status\" buttons to see only late, no-bill, open or released jobs."),
          t("যেকোনো লাইনে চাপ দিলে জবটা খুলবে। সেখানে তারিখ আর খরচ আপডেট করবেন।", "Press any row to open the job and update its dates and cost."),
        ]}
        note={t("বাম পাশে লাল দাগ মানে জবটা দেরি হচ্ছে।", "A red line on the left means the job is late.")}
      />

      <div className="flex flex-wrap gap-2">
        <select aria-label={t("ইম্পোর্টার", "Importer")} className={`${inputCls} sm:w-56`} value={importerId} onChange={(e) => set({ importerId: e.target.value })}>
          <option value="">{t("সব ইম্পোর্টার", "All importers")}</option>
          {importers.data?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select aria-label={t("শিপিং এজেন্ট", "Shipping agent")} className={`${inputCls} sm:w-64`} value={agentId} onChange={(e) => set({ agentId: e.target.value })}>
          <option value="">{t("সব শিপিং এজেন্ট", "All shipping agents")}</option>
          {agents.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label={t("জব নং বা C নং খুঁজুন", "Search job no or C no")}
          placeholder={t("জব নং বা C নং খুঁজুন", "Search job no or C no")}
          className={`${inputCls} sm:w-64`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <Segmented label={t("অবস্থা", "Status")} value={status} options={STATUS} onChange={(v) => set({ status: v })} />

      {jobs.error ? (
        <ErrorBox message={jobs.error} onRetry={jobs.reload} />
      ) : !jobs.data ? (
        <Loading />
      ) : jobs.data.items.length ? (
        <div className={jobs.loading ? "opacity-60" : ""}>
          <JobTable jobs={jobs.data.items} />
        </div>
      ) : (
        <Empty>{t("এই ফিল্টারে কোনো জব নেই।", "No jobs match these filters.")}</Empty>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <JobsInner />
    </Suspense>
  );
}
