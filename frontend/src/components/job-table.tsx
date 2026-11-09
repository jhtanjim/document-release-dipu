"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job } from "@/lib/types";
import { fd, tk } from "@/lib/format";
import { Balance, JobStatus } from "./status";
import { nextStepLabel } from "./job-progress";

export const th = "whitespace-nowrap bg-sunk px-3 py-2.5 text-left text-[12.5px] font-semibold text-muted";
export const td = "whitespace-nowrap border-t border-line px-3 py-2.5 align-middle";

export function JobTable({ jobs, showImporter = true }: { jobs: Job[]; showImporter?: boolean }) {
  const router = useRouter();
  return (
    <>
    {/* Phones: one card per job, the facts people check first */}
    <ul className="flex flex-col gap-2 md:hidden">
      {jobs.map((j) => (
        <li key={j.id}>
          <Link
            href={`/jobs/${j.id}`}
            className={`block rounded-xl border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${j.flags.length ? "border-crit/50 border-l-4 border-l-crit" : "border-line"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">
                  {j.jobNo} {j.cNumber && <span className="num text-[13px] font-normal text-muted">· C {j.cNumber}</span>}
                </p>
                <p className="truncate text-[13.5px] text-muted">
                  {showImporter ? `${j.importer.name} · ` : ""}
                  {j.agent.name}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Balance value={j.balance} />
                <p className="num mt-0.5 text-[12px] text-muted">সিকিউরিটি {tk(j.security)}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <JobStatus job={j} />
              <span className="text-[12.5px] font-semibold text-accent">{nextStepLabel(j)} →</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>জব নং</th>
            <th className={th}>C নং</th>
            {showImporter && <th className={th}>ইম্পোর্টার</th>}
            <th className={th}>শিপিং এজেন্ট</th>
            <th className={th}>কন্টেইনার</th>
            <th className={`${th} text-right`}>সিকিউরিটি</th>
            <th className={th}>ডিপো</th>
            <th className={th}>সার্ভে</th>
            <th className={th}>এজেন্টে জমা</th>
            <th className={th}>হিসাব</th>
            <th className={`${th} text-right`}>ব্যালেন্স</th>
            <th className={th}>অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr
              key={j.id}
              onClick={() => router.push(`/jobs/${j.id}`)}
              className={`cursor-pointer hover:bg-accent-soft ${j.flags.length ? "shadow-[inset_3px_0_0_var(--crit)]" : ""}`}
            >
              <td className={td}>
                <Link href={`/jobs/${j.id}`} className="font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
                  {j.jobNo}
                </Link>
              </td>
              <td className={`${td} num`}>{j.cNumber ?? "—"}</td>
              {showImporter && <td className={td}>{j.importer.name}</td>}
              <td className={td}>{j.agent.name}</td>
              <td className={`${td} num`}>
                {j.containerCount}×{j.containerSize}
              </td>
              <td className={`${td} num text-right`}>{tk(j.security)}</td>
              <td className={`${td} num`}>{fd(j.depotReceivedAt)}</td>
              <td className={`${td} num`}>{fd(j.surveyReceivedAt)}</td>
              <td className={`${td} num`}>{fd(j.submittedToAgentAt)}</td>
              <td className={`${td} num`}>{fd(j.agentBillAt)}</td>
              <td className={`${td} text-right`}>
                <Balance value={j.balance} />
              </td>
              <td className={td}>
                <JobStatus job={j} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
