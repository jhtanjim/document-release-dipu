"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job } from "@/lib/types";
import { fd, tk } from "@/lib/format";
import { Balance, JobStatus } from "./status";

export const th = "whitespace-nowrap bg-sunk px-3 py-2.5 text-left text-[12.5px] font-semibold text-muted";
export const td = "whitespace-nowrap border-t border-line px-3 py-2.5 align-middle";

export function JobTable({ jobs, showImporter = true }: { jobs: Job[]; showImporter?: boolean }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
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
  );
}
