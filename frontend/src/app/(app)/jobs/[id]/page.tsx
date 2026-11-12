"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Pencil } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { isAdmin, type JobDetail } from "@/lib/types";
import { FIELD_LABEL, signed, tk } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Card, ConfirmButton, ErrorBox, Guide, Loading, PageHeader } from "@/components/ui";
import { JobForm } from "@/components/job-form";
import { JobSteps, NextStep } from "@/components/job-progress";
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
  const { lang, t } = useLang();
  const { data: job, error, reload } = useApi<JobDetail>(`/jobs/${id}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!job) return <Loading />;

  async function remove() {
    try {
      await api(`/jobs/${id}`, { method: "DELETE" });
      toast(t(`জব ${job!.jobNo} ডিলিট হয়েছে`, `Job ${job!.jobNo} deleted`));
      router.push("/jobs");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/jobs" className="no-print inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t("সব জব", "All jobs")}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t("জব", "Job")} {job.jobNo} <JobStatus job={job} />
          </span>
        }
        subtitle={`${job.importer.name} · ${job.agent.name}${job.cNumber ? ` · ${t("C নং", "C No")} ${job.cNumber}` : ""}`}
        actions={
          isAdmin(me?.role) ? (
            <ConfirmButton onConfirm={remove} confirmText={t("ডিলিট নিশ্চিত? আবার চাপুন", "Really delete? Press again")}>
              {t("জব ডিলিট", "Delete job")}
            </ConfirmButton>
          ) : undefined
        }
      />

      <Guide
        steps={[
          t("ধাপগুলোর রং: সবুজ = হয়ে গেছে, লাল = দেরি হচ্ছে, নীল = এখন বাকি।", "Step colours: green = done, red = late, blue = next."),
          t("\"পরের কাজ\" বক্সে তারিখ দিয়ে বাটন চাপুন, একটা একটা করে।", "In the \"Next task\" box, enter the date and press the button, one step at a time."),
          t("এজেন্টের হিসাব এলে তারিখের সাথে আসল খরচও দিন; প্লাস/মাইনাস নিজে থেকে হিসাব হবে।", "When the agent's bill arrives, also enter the actual cost; plus/minus is worked out for you."),
          t("ভুল ঠিক করতে নিচের \"সব তথ্য এডিট করুন\" খুলুন।", "To fix a mistake, open \"Edit all details\" below."),
        ]}
      />
      <Card>
        <JobSteps job={job} />
      </Card>
      <NextStep key={job.updatedAt} job={job} onSaved={reload} />
      <Card className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[13px] text-muted">{t("সিকিউরিটি মানি", "Security money")}</p>
          <p className="num text-xl">{tk(job.security)}</p>
          <p className="text-[12.5px] text-muted">
            {job.containerCount}×{job.containerSize} {t("ফুট", "ft")} × {tk(job.ratePerContainer)}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-muted">{t("আসল খরচ", "Actual cost")}</p>
          <p className="num text-xl">{job.actualCost != null ? tk(job.actualCost) : "—"}</p>
        </div>
        <div>
          <p className="text-[13px] text-muted">{t("ব্যালেন্স", "Balance")}</p>
          <p className="text-xl">
            <Balance value={job.balance} />
          </p>
          {job.balance !== null && (
            <p className="text-[12.5px] text-muted">
              {job.balance > 0
                ? t(`${signed(job.balance)} ফেরত পাবো`, `${signed(job.balance)} refund due`)
                : job.balance < 0
                  ? t("বাড়তি খরচ", "Extra cost")
                  : t("সমান সমান", "Even")}
            </p>
          )}
        </div>
      </Card>

      <details className="group rounded-md border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 font-semibold sm:px-5">
          <Pencil className="size-4 text-accent" aria-hidden />
          {t("সব তথ্য এডিট করুন", "Edit all details")}
          <span className="hidden text-sm font-normal text-muted sm:inline">
            {t("(জব নং, C নং, এজেন্ট, কন্টেইনার, রেট, সব তারিখ)", "(job no, C no, agent, containers, rate, all dates)")}
          </span>
          <ChevronDown className="ml-auto size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-line bg-bg p-3 sm:p-4">
          <JobForm key={job.updatedAt} job={job} onSaved={() => reload()} />
        </div>
      </details>

      <Card>
        <h2 className="mb-2 font-bold">{t("পরিবর্তনের ইতিহাস", "Change history")}</h2>
        {job.history.length ? (
          <ol className="flex flex-col divide-y divide-line">
            {job.history.map((h) => (
              <li key={h.id} className="py-2.5 text-[14.5px]">
                <p>
                  <b>{h.user ?? t("অজানা", "Unknown")}</b>{" "}
                  <span className="text-muted">
                    {h.action === "CREATE" ? t("জব তৈরি করেছেন", "created the job") : t("আপডেট করেছেন", "updated")} · {when(h.createdAt)}
                  </span>
                </p>
                {h.action === "UPDATE" && h.changes && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-[13.5px]">
                    {Object.entries(h.changes).map(([k, c]) => (
                      <li key={k}>
                        {FIELD_LABEL[lang][k] ?? k}: <span className="text-muted line-through">{show(k, c.from)}</span> → <b>{show(k, c.to)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">{t("এখনো কোনো পরিবর্তন নেই।", "No changes yet.")}</p>
        )}
      </Card>
    </div>
  );
}
