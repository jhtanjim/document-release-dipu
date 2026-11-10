"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Agent, Importer, JobList } from "@/lib/types";
import { qs } from "@/lib/format";
import { Empty, ErrorBox, Guide, Loading, PageHeader, Segmented, inputCls } from "@/components/ui";
import { JobTable } from "@/components/job-table";

const STATUS = [
  { value: "", label: "সব" },
  { value: "FLAGGED", label: "লাল মার্ক" },
  { value: "SURVEY_LATE", label: "সার্ভে লেট" },
  { value: "BILL_LATE", label: "হিসাব লেট" },
  { value: "OVERDUE", label: "ওভারডিউ" },
  { value: "NO_DEPOT", label: "ডিপো রিসিভিং বাকি" },
  { value: "PENDING_BILL", label: "হিসাব আসেনি" },
  { value: "OPEN", label: "চলমান" },
  { value: "RELEASED", label: "রিলিজড" },
];

function JobsInner() {
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
    const t = window.setTimeout(() => text !== search && set({ search: text.trim() }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const importers = useApi<Importer[]>("/importers");
  const agents = useApi<Agent[]>("/agents");
  const jobs = useApi<JobList>(`/jobs${qs({ importerId, agentId, status, search })}`);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="সব জব"
        subtitle={jobs.data ? `${jobs.data.items.length}টা জব · লাইনে ক্লিক করে খুলুন বা আপডেট করুন` : undefined}
        actions={
          <Link href="/jobs/new" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            <Plus className="size-4" aria-hidden /> নতুন জব
          </Link>
        }
      />

      <Guide
        id="jobs"
        steps={[
          "উপরের ঘর থেকে ইম্পোর্টার বা শিপিং এজেন্ট বাছাই করলে শুধু তাদের জব দেখাবে।",
          "জব নং বা C নং লিখে খুঁজুন, যেমন 254777।",
          "\"অবস্থা\" বাটন দিয়ে শুধু লাল, হিসাব আসেনি, চলমান বা রিলিজড জব দেখুন।",
          "যেকোনো লাইনে চাপ দিলে জবটা খুলবে। সেখানে তারিখ আর খরচ আপডেট করবেন।",
        ]}
        note="বাম পাশে লাল দাগ মানে জবটা দেরি হচ্ছে। শেষ কলামে কারণ আর কত দিন লেখা থাকে।"
      />
      <div className="flex flex-wrap gap-2">
        <select aria-label="ইম্পোর্টার" className={`${inputCls} sm:w-56`} value={importerId} onChange={(e) => set({ importerId: e.target.value })}>
          <option value="">সব ইম্পোর্টার</option>
          {importers.data?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select aria-label="শিপিং এজেন্ট" className={`${inputCls} sm:w-64`} value={agentId} onChange={(e) => set({ agentId: e.target.value })}>
          <option value="">সব শিপিং এজেন্ট</option>
          {agents.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="জব নং বা C নং খুঁজুন"
          placeholder="জব নং বা C নং খুঁজুন"
          className={`${inputCls} sm:w-64`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <Segmented label="অবস্থা" value={status} options={STATUS} onChange={(v) => set({ status: v })} />

      {jobs.error ? (
        <ErrorBox message={jobs.error} onRetry={jobs.reload} />
      ) : !jobs.data ? (
        <Loading />
      ) : jobs.data.items.length ? (
        <div className={jobs.loading ? "opacity-60" : ""}>
          <JobTable jobs={jobs.data.items} />
        </div>
      ) : (
        <Empty>এই ফিল্টারে কোনো জব নেই।</Empty>
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
