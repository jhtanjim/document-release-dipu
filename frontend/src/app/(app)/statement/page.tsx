"use client";

import Link from "next/link";
import { Fragment, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Job, Statement } from "@/lib/types";
import { fd, qs, signed, tk } from "@/lib/format";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Segmented } from "@/components/ui";
import { Balance, JobStatus } from "@/components/status";
import { td, th } from "@/components/job-table";

function sums(items: Job[]) {
  const plus = items.filter((j) => (j.balance ?? 0) > 0).reduce((a, j) => a + j.balance!, 0);
  const minus = items.filter((j) => (j.balance ?? 0) < 0).reduce((a, j) => a + j.balance!, 0);
  return { plus, minus, net: plus + minus, pending: items.filter((j) => j.balance === null).length };
}

function StatementInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const importerId = sp.get("importerId") ?? "";
  const agentId = sp.get("agentId") ?? "";
  const set = (p: { importerId?: string; agentId?: string }) =>
    router.replace(`${pathname}${qs({ importerId, agentId, ...p })}`, { scroll: false });

  const { data, error, loading, reload } = useApi<Statement>(`/reports/statement${qs({ importerId, agentId })}`);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const { matrix, items, totals } = data;
  const count = (i: number, a: number) => matrix.cells.find((c) => c.importerId === i && c.agentId === a)?.count ?? 0;
  const rowTotal = (i: number) => matrix.cells.filter((c) => c.importerId === i).reduce((s, c) => s + c.count, 0);
  const colTotal = (a: number) => matrix.cells.filter((c) => c.agentId === a).reduce((s, c) => s + c.count, 0);
  const grand = matrix.cells.reduce((s, c) => s + c.count, 0);
  const impName = matrix.importers.find((i) => String(i.id) === importerId)?.name;
  const agName = matrix.agents.find((a) => String(a.id) === agentId)?.name;
  const selected = (i: number, a: number) => (importerId || agentId) && (!importerId || importerId === String(i)) && (!agentId || agentId === String(a));
  const groups = importerId ? [{ id: Number(importerId), name: impName ?? "", jobs: items }] : matrix.importers.map((i) => ({ ...i, jobs: items.filter((j) => j.importer.id === i.id) })).filter((g) => g.jobs.length);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`স্টেটমেন্ট · ${[impName ?? "All Jobs", agName].filter(Boolean).join(" · ")}`}
        subtitle={`তারিখ ${fd(data.today)} · ${totals.jobs}টা জব`}
        actions={
          <>
            <a
              href={`/api/reports/statement.xlsx${qs({ importerId, agentId })}`}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-accent"
            >
              <Download className="size-4" aria-hidden /> Excel ডাউনলোড
            </a>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> প্রিন্ট / PDF
            </Button>
          </>
        }
      />

      <section className="no-print flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">কোন শিপিং এজেন্টে কয়টা জব</h2>
          <span className="text-[13px] text-muted">সংখ্যায় ক্লিক করলে নিচের স্টেটমেন্ট সেই ইম্পোর্টার + এজেন্টে ফিল্টার হবে</span>
        </div>
        {matrix.importers.length ? (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>ইম্পোর্টার</th>
                  {matrix.agents.map((a) => (
                    <th key={a.id} className={`${th} text-center`}>
                      {a.name}
                    </th>
                  ))}
                  <th className={`${th} text-center`}>মোট</th>
                </tr>
              </thead>
              <tbody>
                {matrix.importers.map((i) => (
                  <tr key={i.id}>
                    <td className={`${td} font-bold`}>{i.name}</td>
                    {matrix.agents.map((a) => {
                      const n = count(i.id, a.id);
                      return n ? (
                        <td key={a.id} className={`${td} p-0 text-center`}>
                          <button
                            onClick={() => set({ importerId: String(i.id), agentId: String(a.id) })}
                            className={`num w-full px-3 py-2.5 ${selected(i.id, a.id) ? "bg-accent text-accent-ink" : "hover:bg-accent-soft"}`}
                            aria-label={`${i.name}, ${a.name}: ${n}টা জব`}
                          >
                            {n}
                          </button>
                        </td>
                      ) : (
                        <td key={a.id} className={`${td} text-center text-line`}>
                          ·
                        </td>
                      );
                    })}
                    <td className={`${td} num bg-sunk text-center font-bold`}>{rowTotal(i.id)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className={`${td} bg-sunk font-bold`}>মোট</td>
                  {matrix.agents.map((a) => (
                    <td key={a.id} className={`${td} num bg-sunk text-center font-bold`}>
                      {colTotal(a.id)}
                    </td>
                  ))}
                  <td className={`${td} num bg-sunk text-center font-bold`}>{grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty>এখনো কোনো জব নেই।</Empty>
        )}
      </section>

      <div className="no-print flex flex-col gap-2">
        <Segmented
          label="ইম্পোর্টার"
          value={importerId}
          onChange={(v) => set({ importerId: v })}
          options={[{ value: "", label: "All Jobs" }, ...matrix.importers.map((i) => ({ value: String(i.id), label: i.name }))]}
        />
        <Segmented
          label="শিপিং এজেন্ট"
          value={agentId}
          onChange={(v) => set({ agentId: v })}
          options={[{ value: "", label: "সব এজেন্ট" }, ...matrix.agents.map((a) => ({ value: String(a.id), label: a.name }))]}
        />
      </div>

      <Card className={`grid gap-3 sm:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
        <div>
          <p className="text-[13px] text-muted">প্লাস (ফেরত পাবো)</p>
          <p className="num text-2xl text-good">{signed(totals.plus)}</p>
        </div>
        <div>
          <p className="text-[13px] text-muted">মাইনাস (বাড়তি খরচ)</p>
          <p className="num text-2xl text-warn">{signed(totals.minus)}</p>
        </div>
        <div>
          <p className="text-[13px] text-muted">হিসাব আসেনি</p>
          <p className="text-2xl font-semibold text-crit">{totals.pending}টা জব</p>
        </div>
      </Card>

      {items.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>জব নং</th>
                <th className={th}>C নং</th>
                <th className={th}>শিপিং এজেন্ট</th>
                <th className={th}>কন্টেইনার</th>
                <th className={th}>জব রিসিভ</th>
                <th className={th}>হিসাব জমা</th>
                <th className={`${th} text-right`}>সিকিউরিটি</th>
                <th className={`${th} text-right`}>আসল খরচ</th>
                <th className={`${th} text-right`}>অ্যামাউন্ট</th>
                <th className={th}>অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const s = sums(g.jobs);
                return (
                  <Fragment key={g.id}>
                    {!importerId && (
                      <tr>
                        <td colSpan={10} className={`${td} bg-sunk font-bold`}>
                          {g.name} <span className="font-normal text-muted">· {g.jobs.length}টা জব</span>
                        </td>
                      </tr>
                    )}
                    {g.jobs.map((j) => (
                      <tr key={j.id} className={j.flags.length ? "shadow-[inset_3px_0_0_var(--crit)]" : ""}>
                        <td className={td}>
                          <Link href={`/jobs/${j.id}`} className="font-bold hover:underline">
                            {j.jobNo}
                          </Link>
                        </td>
                        <td className={`${td} num`}>{j.cNumber ?? "—"}</td>
                        <td className={td}>{j.agent.name}</td>
                        <td className={`${td} num`}>
                          {j.containerCount}×{j.containerSize}
                        </td>
                        <td className={`${td} num`}>{fd(j.depotReceivedAt)}</td>
                        <td className={`${td} num`}>{fd(j.agentBillAt)}</td>
                        <td className={`${td} num text-right`}>{tk(j.security)}</td>
                        <td className={`${td} num text-right`}>{j.actualCost != null ? tk(j.actualCost) : "—"}</td>
                        <td className={`${td} text-right`}>
                          <Balance value={j.balance} />
                        </td>
                        <td className={td}>
                          <JobStatus job={j} />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={8} className={`${td} text-[13px] font-semibold text-muted`}>
                        {g.name} মোট · প্লাস <span className="num text-good">{signed(s.plus)}</span> · মাইনাস{" "}
                        <span className="num text-warn">{signed(s.minus)}</span>
                        {s.pending ? ` · পেন্ডিং ${s.pending}টা` : ""}
                      </td>
                      <td className={`${td} num text-right font-bold`}>{signed(s.net)}</td>
                      <td className={td} />
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>এই ফিল্টারে কোনো জব নেই।</Empty>
      )}
    </div>
  );
}

export default function StatementPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StatementInner />
    </Suspense>
  );
}
