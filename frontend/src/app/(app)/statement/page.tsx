"use client";

import Link from "next/link";
import { Fragment, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Job, Statement } from "@/lib/types";
import { fd, qs, signed, tk } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Button, Card, Empty, ErrorBox, Guide, Loading, PageHeader, Segmented } from "@/components/ui";
import { Balance, JobStatus } from "@/components/status";
import { td, th } from "@/components/job-table";

function sums(items: Job[]) {
  const plus = items.filter((j) => (j.balance ?? 0) > 0).reduce((a, j) => a + j.balance!, 0);
  const minus = items.filter((j) => (j.balance ?? 0) < 0).reduce((a, j) => a + j.balance!, 0);
  return { plus, minus, net: plus + minus, pending: items.filter((j) => j.balance === null).length };
}

function StatementInner() {
  const { lang, t } = useLang();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const importerId = sp.get("importerId") ?? "";
  const agentId = sp.get("agentId") ?? "";
  const released = sp.get("released") ?? "";
  const set = (p: { importerId?: string; agentId?: string; released?: string }) =>
    router.replace(`${pathname}${qs({ importerId, agentId, released, ...p })}`, { scroll: false });
  const includeReleased = released === "1";

  const { data, error, loading, reload } = useApi<Statement>(`/reports/statement${qs({ importerId, agentId, includeReleased })}`);
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
  const groups = importerId
    ? [{ id: Number(importerId), name: impName ?? "", jobs: items }]
    : matrix.importers.map((i) => ({ ...i, jobs: items.filter((j) => j.importer.id === i.id) })).filter((g) => g.jobs.length);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${t("স্টেটমেন্ট", "Statement")} · ${[impName ?? "All Jobs", agName].filter(Boolean).join(" · ")}`}
        subtitle={t(
          `তারিখ ${fd(data.today)} · ${totals.jobs}টা জব · ${includeReleased ? "রিলিজ হওয়া জবসহ" : "শুধু রিলিজ বাকি জব"}`,
          `Date ${fd(data.today)} · ${totals.jobs} jobs · ${includeReleased ? "including released jobs" : "unreleased jobs only"}`,
        )}
        actions={
          <>
            <a
              href={`/api/reports/statement.xlsx${qs({ importerId, agentId, includeReleased, lang })}`}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-accent"
            >
              <Download className="size-4" aria-hidden /> {t("Excel ডাউনলোড", "Download Excel")}
            </a>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> {t("প্রিন্ট / PDF", "Print / PDF")}
            </Button>
          </>
        }
      />

      <Guide
        note={t(
          "স্টেটমেন্টে শুধু সার্ভে রিপোর্টের তারিখ দেওয়া জব আসে। রিলিজ হওয়া জব নিজে থেকে লুকিয়ে যায়, তবে সব তথ্য সেভ থাকে।",
          "Only jobs with a survey report date appear here. Released jobs are hidden automatically, but their data stays saved.",
        )}
        steps={[
          t("উপরের টেবিলে কোন ইম্পোর্টারের কোন এজেন্টে কয়টা জব, দেখা যায়। সংখ্যায় চাপলে সেই জবগুলো নিচে আসবে।", "The table shows how many jobs each importer has with each agent. Press a number to list those jobs below."),
          t("অথবা বাটন দিয়ে ইম্পোর্টার আর এজেন্ট বাছাই করুন।", "Or pick an importer and an agent with the buttons."),
          t("সবুজ + = টাকা ফেরত পাবেন, কমলা − = বাড়তি খরচ, লাল Pending = হিসাব আসেনি।", "Green + = refund due, orange − = extra cost, red Pending = no bill yet."),
          t("\"Excel ডাউনলোড\" বা \"প্রিন্ট / PDF\" দিয়ে স্টেটমেন্ট দিন।", "Use \"Download Excel\" or \"Print / PDF\" to share it."),
        ]}
      />

      <section className="no-print flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{t("কোন শিপিং এজেন্টে কয়টা জব", "Jobs per shipping agent")}</h2>
          <span className="text-[13px] text-muted">{t("সংখ্যায় ক্লিক করলে নিচের স্টেটমেন্ট ফিল্টার হবে", "Click a number to filter the statement below")}</span>
        </div>
        {matrix.importers.length ? (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>{t("ইম্পোর্টার", "Importer")}</th>
                  {matrix.agents.map((a) => (
                    <th key={a.id} className={`${th} text-center`}>
                      {a.name}
                    </th>
                  ))}
                  <th className={`${th} text-center`}>{t("মোট", "Total")}</th>
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
                            aria-label={`${i.name}, ${a.name}: ${n}`}
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
                  <td className={`${td} bg-sunk font-bold`}>{t("মোট", "Total")}</td>
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
          <Empty>{t("এখনো কোনো জব নেই।", "No jobs yet.")}</Empty>
        )}
      </section>

      <div className="no-print flex flex-col gap-2">
        <Segmented
          label={t("ইম্পোর্টার", "Importer")}
          value={importerId}
          onChange={(v) => set({ importerId: v })}
          options={[{ value: "", label: "All Jobs" }, ...matrix.importers.map((i) => ({ value: String(i.id), label: i.name }))]}
        />
        <Segmented
          label={t("শিপিং এজেন্ট", "Shipping agent")}
          value={agentId}
          onChange={(v) => set({ agentId: v })}
          options={[{ value: "", label: t("সব এজেন্ট", "All agents") }, ...matrix.agents.map((a) => ({ value: String(a.id), label: a.name }))]}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeReleased} onChange={(e) => set({ released: e.target.checked ? "1" : "" })} />
          {t("রিলিজ হওয়া জবও দেখান (সাধারণত লুকানো থাকে)", "Also show released jobs (normally hidden)")}
        </label>
      </div>

      <Card className={`grid gap-3 sm:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
        <div>
          <p className="text-[13px] text-muted">{t("প্লাস (ফেরত পাবো)", "Plus (refund due)")}</p>
          <p className="num text-2xl text-good">{signed(totals.plus)}</p>
        </div>
        <div>
          <p className="text-[13px] text-muted">{t("মাইনাস (বাড়তি খরচ)", "Minus (extra cost)")}</p>
          <p className="num text-2xl text-warn">{signed(totals.minus)}</p>
        </div>
        <div>
          <p className="text-[13px] text-muted">{t("হিসাব আসেনি", "No bill yet")}</p>
          <p className="text-2xl font-semibold text-crit">{t(`${totals.pending}টা জব`, `${totals.pending} jobs`)}</p>
        </div>
      </Card>

      {items.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>{t("জব নং", "Job No")}</th>
                <th className={th}>{t("C নং", "C No")}</th>
                <th className={th}>{t("শিপিং এজেন্ট", "Shipping agent")}</th>
                <th className={th}>{t("কন্টেইনার", "Containers")}</th>
                <th className={th}>{t("জব রিসিভ", "Job received")}</th>
                <th className={th}>{t("হিসাব জমা", "Bill date")}</th>
                <th className={`${th} text-right`}>{t("সিকিউরিটি", "Security")}</th>
                <th className={`${th} text-right`}>{t("আসল খরচ", "Actual cost")}</th>
                <th className={`${th} text-right`}>{t("অ্যামাউন্ট", "Amount")}</th>
                <th className={th}>{t("অবস্থা", "Status")}</th>
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
                          {g.name} <span className="font-normal text-muted">· {t(`${g.jobs.length}টা জব`, `${g.jobs.length} jobs`)}</span>
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
                        {g.name} {t("মোট", "total")} · {t("প্লাস", "plus")} <span className="num text-good">{signed(s.plus)}</span> · {t("মাইনাস", "minus")}{" "}
                        <span className="num text-warn">{signed(s.minus)}</span>
                        {s.pending ? t(` · পেন্ডিং ${s.pending}টা`, ` · ${s.pending} pending`) : ""}
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
        <Empty>{t("এই ফিল্টারে কোনো জব নেই।", "No jobs match these filters.")}</Empty>
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
