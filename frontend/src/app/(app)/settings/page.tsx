"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Check, Minus, Plus, RefreshCw, ShieldCheck, UserPlus, X } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { isAdmin, type Importer, type OperatorRequest, type Settings, type Subscription, type UserItem, type UsersResponse } from "@/lib/types";
import { ROLE_LABEL, fd, tk } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Badge, Button, Card, ErrorBox, Field, Guide, Loading, PageHeader, Segmented, inputCls } from "@/components/ui";
import { useMe, useShellRefresh, useToast } from "@/components/shell";

type Assignable = "ADMIN" | "OPERATOR";
type Tab = "rules" | "importers" | "agents" | "users" | "subscription";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

function RulesTab({ admin }: { admin: boolean }) {
  const { t } = useLang();
  const { data, error, reload } = useApi<Settings>("/settings");
  const [f, setF] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => setF(data), [data]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!f) return <Loading />;

  const num = (k: keyof Settings, label: string, hint: string) => (
    <Field label={label} htmlFor={k} hint={hint}>
      <input id={k} type="number" min={0} disabled={!admin} className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </Field>
  );

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api("/settings", { method: "PATCH", json: f });
      toast(t("নিয়ম সেভ হয়েছে", "Rules saved"));
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {!admin && <p className="text-sm text-muted">{t("এই নিয়মগুলো শুধু অ্যাডমিন বদলাতে পারেন।", "Only admins can change these rules.")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {num("defaultRate", t("ডিফল্ট সিকিউরিটি / কন্টেইনার (টাকা)", "Default security per container (taka)"), t("নতুন জবে এটাই বসবে", "Used for new jobs"))}
        {num("surveyDays", t("সার্ভে লেট (দিন)", "Survey late (days)"), t("ডিপো রিসিভিংয়ের পর এত দিনের বেশি গেলে লাল", "Red when this many days pass after depot receiving"))}
        {num("billDays", t("হিসাব লেট (দিন)", "Bill late (days)"), t("সার্ভে রিপোর্টের পর এত দিন বা বেশি গেলে লাল", "Red when this many days pass after the survey report"))}
        {num("releaseDays", t("ওভারডিউ (দিন)", "Overdue (days)"), t("এজেন্টে জমার পর এত দিনের বেশি গেলে লাল", "Red when this many days pass after submission to the agent"))}
      </div>
      {err && <p className="font-semibold text-crit">{err}</p>}
      {admin && (
        <div className="flex justify-end">
          <Button variant="primary" loading={busy} onClick={save}>
            {t("সেভ করুন", "Save")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function NamesTab({ kind, admin }: { kind: "importers" | "agents"; admin: boolean }) {
  const { t } = useLang();
  const { data, error, reload } = useApi<Importer[]>(`/${kind}`);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();
  const label = kind === "importers" ? t("ইম্পোর্টার", "importer") : t("শিপিং এজেন্ট", "shipping agent");

  async function run(fn: () => Promise<unknown>, msg: string) {
    setErr(null);
    try {
      await fn();
      toast(msg);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <Card className="flex flex-col gap-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run(() => api(`/${kind}`, { json: { name: name.trim() } }).then(() => setName("")), t(`${name.trim()} যোগ হয়েছে`, `${name.trim()} added`));
        }}
      >
        <input
          aria-label={t(`নতুন ${label}`, `New ${label}`)}
          placeholder={kind === "importers" ? t("নতুন ইম্পোর্টার (ইংরেজিতে)", "New importer (in English)") : t("নতুন শিপিং এজেন্ট", "New shipping agent")}
          className={`${inputCls} sm:w-80`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          {t("যোগ করুন", "Add")}
        </Button>
      </form>
      {err && <p className="font-semibold text-crit">{err}</p>}
      <ul className="divide-y divide-line">
        {data.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
            {editing?.id === x.id ? (
              <>
                <input aria-label={t("নাম", "Name")} className={`${inputCls} sm:w-72`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => run(() => api(`/${kind}/${x.id}`, { method: "PATCH", json: { name: editing.name.trim() } }).then(() => setEditing(null)), t("নাম বদলানো হয়েছে", "Name changed"))}
                >
                  {t("সেভ", "Save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  {t("বাতিল", "Cancel")}
                </Button>
              </>
            ) : (
              <>
                <span className={`font-semibold ${x.active ? "" : "text-muted line-through"}`}>{x.name}</span>
                <span className="text-[13px] text-muted">{t(`${x.jobCount}টা জব`, `${x.jobCount} jobs`)}</span>
                {!x.active && <Badge>{t("লুকানো", "Hidden")}</Badge>}
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: x.id, name: x.name })}>
                    {t("নাম বদলান", "Rename")}
                  </Button>
                  {admin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(() => api(`/${kind}/${x.id}`, { method: "PATCH", json: { active: !x.active } }), x.active ? t("লিস্ট থেকে লুকানো হয়েছে", "Hidden from the list") : t("আবার চালু হয়েছে", "Shown again"))
                      }
                    >
                      {x.active ? t("লিস্ট থেকে লুকান", "Hide from list") : t("আবার চালু", "Show again")}
                    </Button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Operator requests: an admin asks for one more operator; the super admin approves or rejects. */
function RequestsPanel({ superAdmin, onChange }: { superAdmin: boolean; onChange: () => void }) {
  const { t } = useLang();
  const { data, error, reload } = useApi<OperatorRequest[]>("/operator-requests");
  const toast = useToast();
  const refreshShell = useShellRefresh();
  const [err, setErr] = useState<string | null>(null);

  async function decide(id: number, approve: boolean) {
    setErr(null);
    try {
      await api(`/operator-requests/${id}`, { method: "PATCH", json: { approve } });
      toast(approve ? t("অনুমতি দেওয়া হয়েছে, সীমা ১ বেড়েছে", "Approved; their limit went up by 1") : t("অনুরোধ বাতিল করা হয়েছে", "Request rejected"));
      reload();
      onChange();
      refreshShell();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !data.length) return null;
  const pending = data.filter((r) => r.status === "PENDING");

  const statusBadge = (s: OperatorRequest["status"]) =>
    s === "PENDING" ? (
      <Badge tone="warn">{t("অপেক্ষায়", "Waiting")}</Badge>
    ) : s === "APPROVED" ? (
      <Badge tone="good">{t("অনুমতি দেওয়া হয়েছে", "Approved")}</Badge>
    ) : (
      <Badge tone="crit">{t("বাতিল", "Rejected")}</Badge>
    );

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 text-accent" aria-hidden />
        {superAdmin ? t("অপারেটর খোলার অনুমতির অনুরোধ", "Requests to open more operators") : t("আমার অনুরোধ", "My requests")}
        {superAdmin && pending.length > 0 && <Badge tone="crit">{t(`${pending.length}টা নতুন`, `${pending.length} new`)}</Badge>}
      </h2>
      {err && <p className="font-semibold text-crit">{err}</p>}
      <ul className="divide-y divide-line">
        {data.slice(0, 20).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {superAdmin
                  ? t(`${r.admin.name} আরও একটা অপারেটর খুলতে চান`, `${r.admin.name} wants to open one more operator`)
                  : t("আরও একটা অপারেটর খোলার অনুরোধ", "Request to open one more operator")}
              </p>
              <p className="text-[13px] text-muted">
                {when(r.createdAt)}
                {superAdmin && t(` · এখনকার সীমা ${r.admin.operatorLimit}টা`, ` · current limit ${r.admin.operatorLimit}`)}
                {r.note && ` · "${r.note}"`}
              </p>
            </div>
            <span className="ml-auto flex items-center gap-2">
              {superAdmin && r.status === "PENDING" ? (
                <>
                  <Button size="sm" variant="primary" onClick={() => decide(r.id, true)}>
                    <Check className="size-4" aria-hidden /> {t("অনুমতি দিন", "Approve")}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(r.id, false)}>
                    <X className="size-4" aria-hidden /> {t("বাতিল", "Reject")}
                  </Button>
                </>
              ) : (
                statusBadge(r.status)
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function UsersTab() {
  const { lang, t } = useLang();
  const { data, error, reload } = useApi<UsersResponse>("/users");
  const me = useMe();
  const superAdmin = me?.role === "SUPER_ADMIN";
  const [f, setF] = useState({ name: "", email: "", password: "", role: "OPERATOR" as Assignable, adminId: "" });
  const [err, setErr] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ id: number; password: string } | null>(null);
  const [note, setNote] = useState("");
  const [reqTick, setReqTick] = useState(0);
  const toast = useToast();

  async function run(fn: () => Promise<unknown>, msg: string) {
    setErr(null);
    try {
      await fn();
      toast(msg);
      reload();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    }
  }

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { items, quota } = data;
  const full = !!quota && quota.used >= quota.limit;
  const canManage = (u: UserItem) => u.role !== "SUPER_ADMIN" && (superAdmin || u.createdById === me?.id);
  const admins = items.filter((u) => u.role === "ADMIN" && u.active);
  // Super admin view: each admin followed by the operators under them, then operators with no admin yet.
  const ordered = superAdmin
    ? [
        ...items.filter((u) => u.role === "SUPER_ADMIN"),
        ...items.filter((u) => u.role === "ADMIN").flatMap((a) => [a, ...items.filter((o) => o.role === "OPERATOR" && o.createdById === a.id)]),
        ...items.filter((o) => o.role === "OPERATOR" && !items.some((a) => a.role === "ADMIN" && a.id === o.createdById)),
      ]
    : items;

  return (
    <div className="flex flex-col gap-4">
      {quota && (
        <Card className={`flex flex-wrap items-center gap-4 ${full ? "border-warn/50" : ""}`}>
          <div className="flex items-center gap-3">
            <span className={`num grid size-14 place-items-center rounded-md text-xl font-bold ${full ? "bg-warn-bg text-warn" : "bg-accent-soft text-accent"}`}>
              {quota.used}/{quota.limit}
            </span>
            <div>
              <p className="font-bold">{t("আমার অপারেটর", "My operators")}</p>
              <p className="text-sm text-muted">
                {t(`আপনি ${quota.limit}টা অপারেটর খুলতে পারেন, ${quota.used}টা খোলা হয়েছে।`, `You can open ${quota.limit} operator(s); ${quota.used} opened.`)}
              </p>
            </div>
          </div>
          {full && (
            <form
              className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run(() => api("/operator-requests", { json: { note } }), t("সুপার অ্যাডমিনের কাছে অনুরোধ পাঠানো হয়েছে", "Request sent to the super admin"))) {
                  setNote("");
                  setReqTick((n) => n + 1);
                }
              }}
            >
              <input aria-label={t("কারণ", "Reason")} placeholder={t("কারণ (ঐচ্ছিক)", "Reason (optional)")} className={`${inputCls} sm:w-56`} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="primary">
                {t("আরও একটার অনুমতি চান", "Ask for one more")}
              </Button>
            </form>
          )}
        </Card>
      )}

      <RequestsPanel key={reqTick} superAdmin={superAdmin} onChange={reload} />

      {!full && (
        <Card className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 font-bold">
            <UserPlus className="size-5 text-accent" aria-hidden />
            {superAdmin ? t("নতুন অ্যাকাউন্ট খুলুন", "Open a new account") : t("নতুন অপারেটর অ্যাকাউন্ট খুলুন", "Open a new operator account")}
          </h2>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const body = {
                name: f.name,
                email: f.email,
                password: f.password,
                role: f.role,
                ...(superAdmin && f.role === "OPERATOR" ? { adminId: Number(f.adminId) || undefined } : {}),
              };
              if (await run(() => api("/users", { json: body }), t(`${f.name}-এর অ্যাকাউন্ট খোলা হয়েছে`, `Account opened for ${f.name}`)))
                setF({ name: "", email: "", password: "", role: "OPERATOR", adminId: "" });
            }}
          >
            <input aria-label={t("নাম", "Name")} placeholder={t("নাম", "Name")} required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input aria-label={t("ইমেইল", "Email")} placeholder={t("ইমেইল", "Email")} type="email" required className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input
              aria-label={t("পাসওয়ার্ড", "Password")}
              placeholder={t("পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)", "Password (8+ characters)")}
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className={inputCls}
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
            {superAdmin ? (
              <select aria-label={t("রোল", "Role")} className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Assignable })}>
                <option value="OPERATOR">{t("অপারেটর: এন্ট্রি ও আপডেট", "Operator: entry and updates")}</option>
                <option value="ADMIN">{t("অ্যাডমিন: রেট, নিয়ম, ডিলিট, অপারেটর খোলা", "Admin: rates, rules, delete, open operators")}</option>
              </select>
            ) : (
              <p className="flex items-center rounded-lg bg-sunk px-3 text-sm text-muted">{t("রোল: অপারেটর", "Role: operator")}</p>
            )}
            {superAdmin && f.role === "OPERATOR" && (
              <select aria-label={t("কোন অ্যাডমিনের অধীনে", "Works under admin")} required className={inputCls} value={f.adminId} onChange={(e) => setF({ ...f, adminId: e.target.value })}>
                <option value="">{t("— কোন অ্যাডমিনের অধীনে? —", "— Works under which admin? —")}</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <Button type="submit" variant="primary">
              {t("অ্যাকাউন্ট খুলুন", "Open account")}
            </Button>
          </form>
          {superAdmin && f.role === "OPERATOR" && !admins.length && (
            <p className="text-sm text-warn">{t("আগে একজন অ্যাডমিন খুলুন। প্রত্যেক অপারেটর কোনো একজন অ্যাডমিনের অধীনে থাকেন।", "Open an admin first. Every operator works under one admin.")}</p>
          )}
        </Card>
      )}
      {err && (
        <p className="rounded-md bg-crit-bg px-4 py-3 font-semibold text-crit" role="alert">
          {err}
        </p>
      )}

      <Card className="flex flex-col gap-2">
        <h2 className="font-bold">{superAdmin ? t("সব অ্যাকাউন্ট", "All accounts") : t("আমার খোলা অপারেটর", "My operators")}</h2>
        {!items.length && <p className="text-muted">{t("এখনো কোনো অ্যাকাউন্ট খোলা হয়নি।", "No accounts yet.")}</p>}
        <ul className="divide-y divide-line">
          {ordered.map((u) => {
            const underAdmin = superAdmin && u.role === "OPERATOR";
            const ownerOk = !!u.createdBy && admins.some((a) => a.id === u.createdBy!.id);
            return (
              <li key={u.id} className={`flex flex-wrap items-center gap-3 py-3 ${underAdmin ? "pl-6 sm:pl-10" : ""}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-full font-bold ${u.role === "OPERATOR" ? "bg-sunk text-muted" : "bg-accent-soft text-accent"}`}>
                  {u.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className={`font-semibold ${u.active ? "" : "text-muted line-through"}`}>{u.name}</p>
                  <p className="text-[13px] text-muted">{u.email}</p>
                </div>
                <Badge tone={u.role === "SUPER_ADMIN" ? "good" : u.role === "ADMIN" ? "info" : "neutral"}>{ROLE_LABEL[lang][u.role]}</Badge>
                {!u.active && <Badge tone="crit">{t("বন্ধ", "Disabled")}</Badge>}
                {underAdmin && (
                  <select
                    aria-label={t("কোন অ্যাডমিনের অধীনে", "Works under admin")}
                    className={`rounded-full border px-2 py-1 text-[13px] ${ownerOk ? "border-line bg-surface" : "border-warn bg-warn-bg text-warn"}`}
                    value={ownerOk ? u.createdBy!.id : ""}
                    onChange={(e) =>
                      e.target.value &&
                      run(() => api(`/users/${u.id}`, { method: "PATCH", json: { adminId: Number(e.target.value) } }), t("অ্যাডমিন বদলানো হয়েছে", "Admin changed"))
                    }
                  >
                    <option value="">{t("⚠ অ্যাডমিন বাছাই করুন", "⚠ Choose an admin")}</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {t(`অ্যাডমিন: ${a.name}`, `Admin: ${a.name}`)}
                      </option>
                    ))}
                  </select>
                )}
                {superAdmin && u.role === "ADMIN" && (
                  <span className="flex items-center gap-1 rounded-full border border-line px-1 py-0.5 text-[13px]" title={t("এই অ্যাডমিন কয়টা অপারেটর খুলতে পারবেন", "How many operators this admin may open")}>
                    <button
                      type="button"
                      aria-label={t("সীমা কমান", "Lower limit")}
                      className="grid size-6 place-items-center rounded-full hover:bg-sunk disabled:opacity-40"
                      disabled={u.operatorLimit <= 0}
                      onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { operatorLimit: u.operatorLimit - 1 } }), t("সীমা কমানো হয়েছে", "Limit lowered"))}
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="px-1">
                      {t("অপারেটর", "Operators")}{" "}
                      <b className="num">
                        {u.operatorsUsed ?? 0}/{u.operatorLimit}
                      </b>
                    </span>
                    <button
                      type="button"
                      aria-label={t("সীমা বাড়ান", "Raise limit")}
                      className="grid size-6 place-items-center rounded-full hover:bg-sunk"
                      onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { operatorLimit: u.operatorLimit + 1 } }), t("সীমা বাড়ানো হয়েছে", "Limit raised"))}
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </span>
                )}
                <span className="ml-auto flex flex-wrap gap-2">
                  {!canManage(u) && u.id !== me?.id ? null : resetFor?.id === u.id ? (
                    <>
                      <input
                        aria-label={t("নতুন পাসওয়ার্ড", "New password")}
                        type="password"
                        autoComplete="new-password"
                        placeholder={t("নতুন পাসওয়ার্ড", "New password")}
                        className={`${inputCls} w-44`}
                        value={resetFor.password}
                        onChange={(e) => setResetFor({ ...resetFor, password: e.target.value })}
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          if (await run(() => api(`/users/${u.id}`, { method: "PATCH", json: { password: resetFor.password } }), t("পাসওয়ার্ড বদলানো হয়েছে", "Password changed")))
                            setResetFor(null);
                        }}
                      >
                        {t("সেভ", "Save")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setResetFor(null)}>
                        {t("বাতিল", "Cancel")}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setResetFor({ id: u.id, password: "" })}>
                      {t("পাসওয়ার্ড বদলান", "Change password")}
                    </Button>
                  )}
                  {u.id !== me?.id && canManage(u) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(() => api(`/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }), u.active ? t("অ্যাকাউন্ট বন্ধ করা হয়েছে", "Account disabled") : t("অ্যাকাউন্ট চালু হয়েছে", "Account enabled"))
                      }
                    >
                      {u.active ? t("বন্ধ করুন", "Disable") : t("চালু করুন", "Enable")}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function SubscriptionTab() {
  const { t } = useLang();
  const { data, error, reload } = useApi<Subscription>("/subscription");
  const [f, setF] = useState<{ plan: string; periodMonths: number; amount: string; endsAt: string; autoRenew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const refreshShell = useShellRefresh();
  useEffect(() => {
    if (data) setF({ plan: data.plan, periodMonths: data.periodMonths, amount: data.amount == null ? "" : String(data.amount), endsAt: data.endsAt, autoRenew: data.autoRenew });
  }, [data]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !f) return <Loading />;

  async function call(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      toast(msg);
      reload();
      refreshShell();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tone =
    data.status === "ACTIVE"
      ? { box: "bg-good-bg text-good", text: "text-good" }
      : data.status === "EXPIRING"
        ? { box: "bg-warn-bg text-warn", text: "text-warn" }
        : { box: "bg-crit-bg text-crit", text: "text-crit" };
  const EVENT = { RENEW_AUTO: t("অটো-রিনিউ", "Auto-renew"), RENEW_MANUAL: t("হাতে রিনিউ", "Manual renew"), UPDATE: t("তারিখ বদলানো", "Date changed") };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-5">
        <span className={`grid size-16 place-items-center rounded-md ${tone.box}`}>
          <CalendarClock className="size-8" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">{t(`${data.plan} প্ল্যান`, `${data.plan} plan`)}</p>
          <p className={`text-2xl font-bold ${tone.text}`}>
            {data.status === "EXPIRED" ? t("মেয়াদ শেষ", "Expired") : t(`চালু · ${data.daysLeft} দিন বাকি`, `Active · ${data.daysLeft} days left`)}
          </p>
          <p className="text-sm text-muted">
            {t(`${fd(data.endsAt)} পর্যন্ত · প্রতি ${data.periodMonths} মাসে`, `Until ${fd(data.endsAt)} · every ${data.periodMonths} month(s)`)}
            {data.amount != null ? ` · ${tk(data.amount)} ${t("টাকা", "taka")}` : ""} · {t("অটো-রিনিউ", "Auto-renew")} {data.autoRenew ? t("চালু", "on") : t("বন্ধ", "off")}
          </p>
        </div>
        <Button className="ml-auto" variant="primary" loading={busy} onClick={() => call(() => api("/subscription/renew", { method: "POST" }), t("এক মেয়াদ বাড়ানো হয়েছে", "Extended by one period"))}>
          <RefreshCw className="size-4" aria-hidden /> {t(`এখনই ${data.periodMonths} মাস বাড়ান`, `Extend ${data.periodMonths} month(s) now`)}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-bold">{t("সাবস্ক্রিপশনের সেটিং", "Subscription settings")}</h2>
        <label className="flex items-start gap-3 rounded-md border border-line p-4">
          <input type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" checked={f.autoRenew} onChange={(e) => setF({ ...f, autoRenew: e.target.checked })} />
          <span>
            <b>{t("অটো-রিনিউ", "Auto-renew")}</b>
            <span className="block text-sm text-muted">
              {t(
                `চালু থাকলে মেয়াদ শেষের দিন নিজে থেকে আরও ${f.periodMonths} মাস বাড়বে। বন্ধ থাকলে মেয়াদ শেষে আপনি ছাড়া কেউ কাজ করতে পারবেন না।`,
                `When on, the end date moves ${f.periodMonths} month(s) ahead by itself. When off, only you can work after it ends.`,
              )}
            </span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("প্ল্যানের নাম", "Plan name")} htmlFor="plan">
            <input id="plan" className={inputCls} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} />
          </Field>
          <Field label={t("প্রতি মেয়াদ (মাস)", "Period (months)")} htmlFor="periodMonths" hint={t("১ = মাসিক, ১২ = বার্ষিক", "1 = monthly, 12 = yearly")}>
            <input id="periodMonths" type="number" min={1} max={36} className={inputCls} value={f.periodMonths} onChange={(e) => setF({ ...f, periodMonths: Number(e.target.value) })} />
          </Field>
          <Field label={t("ফি (টাকা, ঐচ্ছিক)", "Fee (taka, optional)")} htmlFor="amount" hint={t("শুধু মনে রাখার জন্য", "For reference only")}>
            <input id="amount" type="number" min={0} className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label={t("মেয়াদ শেষের তারিখ", "End date")} htmlFor="endsAt">
            <input id="endsAt" type="date" className={inputCls} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
          </Field>
        </div>
        {err && <p className="font-semibold text-crit">{err}</p>}
        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={busy}
            onClick={() =>
              call(
                () =>
                  api("/subscription", {
                    method: "PATCH",
                    json: { plan: f.plan, periodMonths: f.periodMonths, amount: f.amount === "" ? null : Number(f.amount), endsAt: f.endsAt, autoRenew: f.autoRenew },
                  }),
                t("সাবস্ক্রিপশন সেভ হয়েছে", "Subscription saved"),
              )
            }
          >
            {t("সেভ করুন", "Save")}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">{t("রিনিউয়ের ইতিহাস", "Renewal history")}</h2>
        {data.events?.length ? (
          <ul className="divide-y divide-line text-[14.5px]">
            {data.events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 py-2">
                <Badge tone={e.type === "UPDATE" ? "neutral" : "good"}>{EVENT[e.type]}</Badge>
                <span>
                  {fd(e.fromDate)} → <b>{fd(e.toDate)}</b>
                </span>
                <span className="ml-auto text-muted">{when(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("এখনো কোনো রিনিউ হয়নি।", "No renewals yet.")}</p>
        )}
      </Card>
    </div>
  );
}

function SettingsInner() {
  const { t } = useLang();
  const me = useMe();
  const admin = isAdmin(me?.role);
  const superAdmin = me?.role === "SUPER_ADMIN";
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabs: { value: Tab; label: string }[] = [
    { value: "rules", label: t("নিয়ম ও রেট", "Rules and rate") },
    { value: "importers", label: t("ইম্পোর্টার", "Importers") },
    { value: "agents", label: t("শিপিং এজেন্ট", "Shipping agents") },
    ...(admin ? [{ value: "users" as Tab, label: superAdmin ? t("ইউজার অ্যাকাউন্ট", "User accounts") : t("অপারেটর অ্যাকাউন্ট", "Operator accounts") }] : []),
    ...(superAdmin ? [{ value: "subscription" as Tab, label: t("সাবস্ক্রিপশন", "Subscription") }] : []),
  ];
  const asked = sp.get("tab") as Tab | null;
  const tab: Tab = asked && tabs.some((x) => x.value === asked) ? asked : "rules";
  const setTab = (v: Tab) => router.replace(`${pathname}?tab=${v}`, { scroll: false });

  const guides: Record<Tab, string[]> = {
    rules: [
      t("ডিফল্ট সিকিউরিটি: নতুন জবে প্রতি কন্টেইনারের এই রেট বসে।", "Default security: this rate per container is used for new jobs."),
      t("দিনের সংখ্যাগুলো ঠিক করে কখন জব লাল হবে।", "The day numbers decide when a job turns red."),
      t("বদলে \"সেভ করুন\" চাপুন; সব জবে সাথে সাথে খাটবে।", "Change and press \"Save\"; it applies to all jobs at once."),
    ],
    importers: [
      t("নাম ইংরেজিতে লিখে \"যোগ করুন\" চাপুন।", "Type the name in English and press \"Add\"."),
      t("বানান ভুল হলে \"নাম বদলান\"।", "Use \"Rename\" to fix spelling."),
      t("পুরোনো নাম \"লিস্ট থেকে লুকান\"; পুরোনো জবে থেকে যাবে।", "\"Hide from list\" removes it from new jobs; old jobs keep it."),
    ],
    agents: [
      t("ক্লায়েন্টের ৯টা শিপিং এজেন্ট আগে থেকেই আছে।", "The client's 9 shipping agents are already listed."),
      t("নতুন এজেন্ট লাগলে নাম লিখে \"যোগ করুন\"।", "Type a name and press \"Add\" for a new agent."),
      t("পুরোনো এজেন্ট \"লিস্ট থেকে লুকান\"।", "\"Hide from list\" for agents you no longer use."),
    ],
    users: superAdmin
      ? [
          t("নাম, ইমেইল, পাসওয়ার্ড আর রোল দিয়ে অ্যাকাউন্ট খুলুন।", "Open an account with name, email, password and role."),
          t("প্রত্যেক অপারেটর একজন অ্যাডমিনের অধীনে থাকেন; খোলার সময় অ্যাডমিন বাছাই করুন।", "Every operator works under one admin; pick the admin when opening it."),
          t("অ্যাডমিন শুরুতে ১টা অপারেটর খুলতে পারেন; − / + দিয়ে সীমা বদলান।", "Admins can open 1 operator to start; change it with − / +."),
          t("অ্যাডমিনের অনুরোধ এলে \"অনুমতি দিন\" চাপলে সীমা ১ বাড়বে।", "Press \"Approve\" on an admin's request to raise their limit by 1."),
        ]
      : [
          t("উপরের বক্সে দেখুন কয়টা অপারেটর খুলতে পারবেন।", "The box at the top shows how many operators you can open."),
          t("জায়গা থাকলে নাম, ইমেইল, পাসওয়ার্ড দিয়ে অপারেটর খুলুন।", "If there is room, open an operator with name, email and password."),
          t("সীমা শেষ হলে \"আরও একটার অনুমতি চান\"।", "When the limit is reached, press \"Ask for one more\"."),
        ],
    subscription: [
      t("উপরে দেখুন কত দিন বাকি। ৭ দিন বা কম থাকলে হলুদ সতর্কবার্তা আসে।", "See the days left at the top. A yellow warning shows at 7 days or less."),
      t("অটো-রিনিউ চালু থাকলে মেয়াদ নিজে থেকে বাড়ে।", "With auto-renew on, it extends by itself."),
      t("মেয়াদ শেষ হলে আপনি ছাড়া কেউ কাজ করতে পারবেন না; ডেটা সেভ থাকে।", "If it ends, only you can work; all data stays saved."),
    ],
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("সেটিংস", "Settings")} subtitle={t("নিয়ম, লিস্ট, অ্যাকাউন্ট আর সাবস্ক্রিপশন", "Rules, lists, accounts and subscription")} />
      <Segmented value={tab} onChange={setTab} options={tabs} />
      <Guide steps={guides[tab]} />
      {tab === "rules" && <RulesTab admin={admin} />}
      {tab === "importers" && <NamesTab kind="importers" admin={admin} />}
      {tab === "agents" && <NamesTab kind="agents" admin={admin} />}
      {tab === "users" && admin && <UsersTab />}
      {tab === "subscription" && superAdmin && <SubscriptionTab />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsInner />
    </Suspense>
  );
}
