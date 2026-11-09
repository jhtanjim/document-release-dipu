"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { isAdmin, type JobDetail } from "@/lib/types";
import { FIELD_LABEL, signed, tk } from "@/lib/format";
import { Card, ConfirmButton, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { JobForm } from "@/components/job-form";
import { Balance, JobStatus } from "@/components/status";
import { useMe, useToast } from "@/components/shell";

const show = (k: string, v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number" && (k === "actualCost" || k === "ratePerContainer")) return tk(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(0, 4)}`;
  return String(v);
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const { data: job, error, reload } = useApi<JobDetail>(`/jobs/${id}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!job) return <Loading />;

  async function remove() {
    try {
      await api(`/jobs/${id}`, { method: "DELETE" });
      toast(`জব ${job!.jobNo} ডিলিট হয়েছে`);
      router.push("/jobs");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/jobs" className="no-print inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> সব জব
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            জব {job.jobNo} <JobStatus job={job} />
          </span>
        }
        subtitle={`${job.importer.name} · ${job.agent.name}${job.cNumber ? ` · C নং ${job.cNumber}` : ""}`}
        actions={isAdmin(me?.role) ? <ConfirmButton onConfirm={remove} confirmText="ডিলিট নিশ্চিত? আবার চাপুন">জব ডিলিট</ConfirmButton> : undefined}
      />

      <Card className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[13px] text-muted">সিকিউরিটি মানি</p>
          <p className="num text-xl">{tk(job.security)}</p>
          <p className="text-[12.5px] text-muted">
            {job.containerCount}×{job.containerSize} ফুট × {tk(job.ratePerContainer)}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-muted">আসল খরচ</p>
          <p className="num text-xl">{job.actualCost != null ? tk(job.actualCost) : "—"}</p>
        </div>
        <div>
          <p className="text-[13px] text-muted">ব্যালেন্স</p>
          <p className="text-xl">
            <Balance value={job.balance} />
          </p>
          {job.balance !== null && (
            <p className="text-[12.5px] text-muted">{job.balance > 0 ? `${signed(job.balance)} ফেরত পাবো` : job.balance < 0 ? "বাড়তি খরচ" : "সমান সমান"}</p>
          )}
        </div>
      </Card>

      <JobForm key={job.updatedAt} job={job} onSaved={() => reload()} />

      <Card>
        <h2 className="mb-2 font-bold">পরিবর্তনের ইতিহাস</h2>
        {job.history.length ? (
          <ol className="flex flex-col divide-y divide-line">
            {job.history.map((h) => (
              <li key={h.id} className="py-2.5 text-sm">
                <p>
                  <b>{h.user ?? "অজানা"}</b>{" "}
                  <span className="text-muted">
                    {h.action === "CREATE" ? "জব তৈরি করেছেন" : "আপডেট করেছেন"} · {when(h.createdAt)}
                  </span>
                </p>
                {h.action === "UPDATE" && h.changes && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-[13.5px]">
                    {Object.entries(h.changes).map(([k, c]) => (
                      <li key={k}>
                        {FIELD_LABEL[k] ?? k}: <span className="text-muted line-through">{show(k, c.from)}</span> → <b>{show(k, c.to)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">এখনো কোনো পরিবর্তন নেই।</p>
        )}
      </Card>
    </div>
  );
}
