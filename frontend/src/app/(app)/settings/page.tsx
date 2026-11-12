"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Check, Minus, Plus, RefreshCw, ShieldCheck, UserPlus, X } from "lucide-react";
import { api, useApi } from "@/lib/api";
import {
  isAdmin,
  ROLE_LABEL,
  type Importer,
  type OperatorRequest,
  type Settings,
  type Subscription,
  type UserItem,
  type UsersResponse,
} from "@/lib/types";
import { fd, tk } from "@/lib/format";
import { Badge, Button, Card, ErrorBox, Field, Guide, Loading, PageHeader, Segmented, inputCls } from "@/components/ui";
import { useMe, useShellRefresh, useToast } from "@/components/shell";

type Assignable = "ADMIN" | "OPERATOR";
type Tab = "rules" | "importers" | "agents" | "users" | "subscription";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

function RulesTab({ admin }: { admin: boolean }) {
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
      toast("নিয়ম সেভ হয়েছে");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {!admin && <p className="text-sm text-muted">এই নিয়মগুলো শুধু অ্যাডমিন বদলাতে পারেন।</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {num("defaultRate", "ডিফল্ট সিকিউরিটি / কন্টেইনার (টাকা)", "নতুন জবে এটাই বসবে, জবে আলাদা করে বদলানো যায়")}
        {num("surveyDays", "সার্ভে লেট (দিন)", "ডিপো রিসিভিংয়ের পর এত দিনের বেশি গেলে লাল")}
        {num("billDays", "হিসাব লেট (দিন)", "সার্ভে রিপোর্টের পর এত দিন বা বেশি গেলে লাল")}
        {num("releaseDays", "ওভারডিউ (দিন)", "এজেন্টে জমার পর এত দিনের বেশি গেলে লাল")}
      </div>
      {err && <p className="font-semibold text-crit">{err}</p>}
      {admin && (
        <div className="flex justify-end">
          <Button variant="primary" loading={busy} onClick={save}>
            সেভ করুন
          </Button>
        </div>
      )}
    </Card>
  );
}

function NamesTab({ kind, admin }: { kind: "importers" | "agents"; admin: boolean }) {
  const { data, error, reload } = useApi<Importer[]>(`/${kind}`);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();
  const label = kind === "importers" ? "ইম্পোর্টার" : "শিপিং এজেন্ট";

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
          if (name.trim()) run(() => api(`/${kind}`, { json: { name: name.trim() } }).then(() => setName("")), `${name.trim()} যোগ হয়েছে`);
        }}
      >
        <input
          aria-label={`নতুন ${label}`}
          placeholder={kind === "importers" ? "নতুন ইম্পোর্টার (ইংরেজিতে)" : "নতুন শিপিং এজেন্ট"}
          className={`${inputCls} sm:w-80`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          যোগ করুন
        </Button>
      </form>
      {err && <p className="font-semibold text-crit">{err}</p>}
      <ul className="divide-y divide-line">
        {data.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
            {editing?.id === x.id ? (
              <>
                <input aria-label="নাম" className={`${inputCls} sm:w-72`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <Button size="sm" variant="primary" onClick={() => run(() => api(`/${kind}/${x.id}`, { method: "PATCH", json: { name: editing.name.trim() } }).then(() => setEditing(null)), "নাম বদলানো হয়েছে")}>
                  সেভ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  বাতিল
                </Button>
              </>
            ) : (
              <>
                <span className={`font-semibold ${x.active ? "" : "text-muted line-through"}`}>{x.name}</span>
                <span className="text-[13px] text-muted">{x.jobCount}টা জব</span>
                {!x.active && <Badge>বন্ধ</Badge>}
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: x.id, name: x.name })}>
                    নাম বদলান
                  </Button>
                  {admin && (
                    <Button size="sm" variant="ghost" onClick={() => run(() => api(`/${kind}/${x.id}`, { method: "PATCH", json: { active: !x.active } }), x.active ? "লিস্ট থেকে লুকানো হয়েছে" : "আবার চালু হয়েছে")}>
                      {x.active ? "লিস্ট থেকে লুকান" : "আবার চালু"}
                    </Button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-muted">লুকানো {label} নতুন জবের লিস্টে আসবে না, কিন্তু পুরোনো জব আর স্টেটমেন্টে থাকবে।</p>
    </Card>
  );
}

/** Operator requests: an admin asks for one more operator; the super admin approves or rejects. */
function RequestsPanel({ superAdmin, onChange }: { superAdmin: boolean; onChange: () => void }) {
  const { data, error, reload } = useApi<OperatorRequest[]>("/operator-requests");
  const toast = useToast();
  const refreshShell = useShellRefresh();
  const [err, setErr] = useState<string | null>(null);

  async function decide(id: number, approve: boolean) {
    setErr(null);
    try {
      await api(`/operator-requests/${id}`, { method: "PATCH", json: { approve } });
      toast(approve ? "অনুমতি দেওয়া হয়েছে, অপারেটরের সীমা ১ বেড়েছে" : "অনুরোধ বাতিল করা হয়েছে");
      reload();
      onChange();
      refreshShell();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const pending = data.filter((r) => r.status === "PENDING");
  if (!superAdmin && !data.length) return null;

  const statusBadge = (s: OperatorRequest["status"]) =>
    s === "PENDING" ? <Badge tone="warn">অপেক্ষায়</Badge> : s === "APPROVED" ? <Badge tone="good">অনুমতি দেওয়া হয়েছে</Badge> : <Badge tone="crit">বাতিল</Badge>;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 text-accent" aria-hidden />
        {superAdmin ? "অপারেটর খোলার অনুমতির অনুরোধ" : "আমার অনুরোধ"}
        {superAdmin && pending.length > 0 && <Badge tone="crit">{pending.length}টা নতুন</Badge>}
      </h2>
      {superAdmin && !data.length && <p className="text-muted">এখনো কোনো অনুরোধ আসেনি।</p>}
      {err && <p className="font-semibold text-crit">{err}</p>}
      <ul className="divide-y divide-line">
        {data.slice(0, 20).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {superAdmin ? `${r.admin.name} আরও একটা অপারেটর খুলতে চান` : "আরও একটা অপারেটর খোলার অনুরোধ"}
              </p>
              <p className="text-[13px] text-muted">
                {when(r.createdAt)}
                {superAdmin && ` · এখনকার সীমা ${r.admin.operatorLimit}টা`}
                {r.note && ` · "${r.note}"`}
              </p>
            </div>
            <span className="ml-auto flex items-center gap-2">
              {superAdmin && r.status === "PENDING" ? (
                <>
                  <Button size="sm" variant="primary" onClick={() => decide(r.id, true)}>
                    <Check className="size-4" aria-hidden /> অনুমতি দিন
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(r.id, false)}>
                    <X className="size-4" aria-hidden /> বাতিল
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
  const { data, error, reload } = useApi<UsersResponse>("/users");
  const me = useMe();
  const superAdmin = me?.role === "SUPER_ADMIN";
  const [f, setF] = useState({ name: "", email: "", password: "", role: "OPERATOR" as Assignable });
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

  return (
    <div className="flex flex-col gap-4">
      {quota && (
        <Card className={`flex flex-wrap items-center gap-4 ${full ? "border-warn/50" : ""}`}>
          <div className="flex items-center gap-3">
            <span className={`num grid size-14 place-items-center rounded-2xl text-xl font-bold ${full ? "bg-warn-bg text-warn" : "bg-accent-soft text-accent"}`}>
              {quota.used}/{quota.limit}
            </span>
            <div>
              <p className="font-bold">অপারেটর অ্যাকাউন্ট</p>
              <p className="text-sm text-muted">
                আপনি {quota.limit}টা অপারেটর খুলতে পারেন, {quota.used}টা খোলা হয়েছে।
              </p>
            </div>
          </div>
          {full && (
            <form
              className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run(() => api("/operator-requests", { json: { note } }), "সুপার অ্যাডমিনের কাছে অনুরোধ পাঠানো হয়েছে")) {
                  setNote("");
                  setReqTick((t) => t + 1);
                }
              }}
            >
              <input aria-label="কারণ" placeholder="কারণ (ঐচ্ছিক), যেমন নতুন সহকর্মী" className={`${inputCls} sm:w-64`} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="primary">
                আরও একটার অনুমতি চান
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
            {superAdmin ? "নতুন অ্যাকাউন্ট খুলুন" : "নতুন অপারেটর অ্যাকাউন্ট খুলুন"}
          </h2>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => api("/users", { json: f }), `${f.name}-এর অ্যাকাউন্ট খোলা হয়েছে`))
                setF({ name: "", email: "", password: "", role: "OPERATOR" });
            }}
          >
            <input aria-label="নাম" placeholder="নাম" required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input aria-label="ইমেইল" placeholder="ইমেইল" type="email" required className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input
              aria-label="পাসওয়ার্ড"
              placeholder="পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className={inputCls}
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
            {superAdmin ? (
              <select aria-label="রোল" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Assignable })}>
                <option value="OPERATOR">অপারেটর: এন্ট্রি ও আপডেট</option>
                <option value="ADMIN">অ্যাডমিন: রেট, নিয়ম, ডিলিট, ১টা অপারেটর খোলা</option>
              </select>
            ) : (
              <p className="flex items-center rounded-lg bg-sunk px-3 text-sm text-muted">রোল: অপারেটর</p>
            )}
            <Button type="submit" variant="primary">
              অ্যাকাউন্ট খুলুন
            </Button>
          </form>
        </Card>
      )}
      {err && (
        <p className="rounded-xl bg-crit-bg px-4 py-3 font-semibold text-crit" role="alert">
          {err}
        </p>
      )}

      <Card className="flex flex-col gap-2">
        <h2 className="font-bold">{superAdmin ? "সব অ্যাকাউন্ট" : "আমার খোলা অপারেটর"}</h2>
        {!items.length && <p className="text-muted">এখনো কোনো অ্যাকাউন্ট খোলা হয়নি।</p>}
        <ul className="divide-y divide-line">
          {items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunk font-bold text-muted">{u.name.slice(0, 1)}</span>
              <div className="min-w-0">
                <p className={`font-semibold ${u.active ? "" : "text-muted line-through"}`}>{u.name}</p>
                <p className="text-[13px] text-muted">{u.email}</p>
              </div>
              <Badge tone={u.role === "SUPER_ADMIN" ? "good" : u.role === "ADMIN" ? "info" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
              {!u.active && <Badge tone="crit">বন্ধ</Badge>}
              {superAdmin && u.role === "ADMIN" && (
                <span className="flex items-center gap-1 rounded-full border border-line px-1 py-0.5 text-[13px]" title="এই অ্যাডমিন কয়টা অপারেটর খুলতে পারবেন">
                  <button
                    type="button"
                    aria-label="সীমা কমান"
                    className="grid size-6 place-items-center rounded-full hover:bg-sunk disabled:opacity-40"
                    disabled={u.operatorLimit <= 0}
                    onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { operatorLimit: u.operatorLimit - 1 } }), "অপারেটরের সীমা কমানো হয়েছে")}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="px-1">
                    অপারেটর <b className="num">{u.operatorsUsed ?? 0}/{u.operatorLimit}</b>
                  </span>
                  <button
                    type="button"
                    aria-label="সীমা বাড়ান"
                    className="grid size-6 place-items-center rounded-full hover:bg-sunk"
                    onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { operatorLimit: u.operatorLimit + 1 } }), "অপারেটরের সীমা বাড়ানো হয়েছে")}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </span>
              )}
              <span className="ml-auto flex flex-wrap gap-2">
                {!canManage(u) && u.id !== me?.id ? null : resetFor?.id === u.id ? (
                  <>
                    <input
                      aria-label="নতুন পাসওয়ার্ড"
                      type="password"
                      autoComplete="new-password"
                      placeholder="নতুন পাসওয়ার্ড"
                      className={`${inputCls} w-48`}
                      value={resetFor.password}
                      onChange={(e) => setResetFor({ ...resetFor, password: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        if (await run(() => api(`/users/${u.id}`, { method: "PATCH", json: { password: resetFor.password } }), "পাসওয়ার্ড বদলানো হয়েছে")) setResetFor(null);
                      }}
                    >
                      সেভ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResetFor(null)}>
                      বাতিল
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setResetFor({ id: u.id, password: "" })}>
                    পাসওয়ার্ড বদলান
                  </Button>
                )}
                {u.id !== me?.id && canManage(u) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }), u.active ? "অ্যাকাউন্ট বন্ধ করা হয়েছে" : "অ্যাকাউন্ট চালু হয়েছে")}
                  >
                    {u.active ? "বন্ধ করুন" : "চালু করুন"}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const EVENT_LABEL = { RENEW_AUTO: "অটো-রিনিউ", RENEW_MANUAL: "হাতে রিনিউ", UPDATE: "তারিখ বদলানো" } as const;

function SubscriptionTab() {
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

  const tone = data.status === "ACTIVE" ? "good" : data.status === "EXPIRING" ? "warn" : "crit";
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-5">
        <span className={`grid size-16 place-items-center rounded-2xl bg-${tone}-bg text-${tone}`}>
          <CalendarClock className="size-8" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">{data.plan} প্ল্যান</p>
          <p className={`text-2xl font-bold text-${tone}`}>
            {data.status === "EXPIRED" ? "মেয়াদ শেষ" : `চালু · ${data.daysLeft} দিন বাকি`}
          </p>
          <p className="text-sm text-muted">
            {fd(data.endsAt)} পর্যন্ত · প্রতি {data.periodMonths} মাসে
            {data.amount != null ? ` ${tk(data.amount)} টাকা` : ""} · অটো-রিনিউ {data.autoRenew ? "চালু" : "বন্ধ"}
          </p>
        </div>
        <Button className="ml-auto" variant="primary" loading={busy} onClick={() => call(() => api("/subscription/renew", { method: "POST" }), "সাবস্ক্রিপশন এক মেয়াদ বাড়ানো হয়েছে")}>
          <RefreshCw className="size-4" aria-hidden /> এখনই {data.periodMonths} মাস বাড়ান
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-bold">সাবস্ক্রিপশনের সেটিং</h2>
        <label className="flex items-start gap-3 rounded-xl border border-line p-4">
          <input type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" checked={f.autoRenew} onChange={(e) => setF({ ...f, autoRenew: e.target.checked })} />
          <span>
            <b>অটো-রিনিউ</b>
            <span className="block text-sm text-muted">
              চালু থাকলে মেয়াদ শেষ হওয়ার দিন নিজে থেকে আরও {f.periodMonths} মাস বেড়ে যাবে। বন্ধ থাকলে মেয়াদ শেষে আপনি ছাড়া কেউ লগইন করে কাজ করতে পারবেন না।
            </span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="প্ল্যানের নাম" htmlFor="plan">
            <input id="plan" className={inputCls} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} />
          </Field>
          <Field label="প্রতি মেয়াদ (মাস)" htmlFor="periodMonths" hint="১ = মাসিক, ১২ = বার্ষিক">
            <input id="periodMonths" type="number" min={1} max={36} className={inputCls} value={f.periodMonths} onChange={(e) => setF({ ...f, periodMonths: Number(e.target.value) })} />
          </Field>
          <Field label="ফি (টাকা, ঐচ্ছিক)" htmlFor="amount" hint="শুধু মনে রাখার জন্য">
            <input id="amount" type="number" min={0} className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="মেয়াদ শেষের তারিখ" htmlFor="endsAt">
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
                "সাবস্ক্রিপশন সেভ হয়েছে",
              )
            }
          >
            সেভ করুন
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">রিনিউয়ের ইতিহাস</h2>
        {data.events?.length ? (
          <ul className="divide-y divide-line text-sm">
            {data.events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 py-2">
                <Badge tone={e.type === "UPDATE" ? "neutral" : "good"}>{EVENT_LABEL[e.type]}</Badge>
                <span>
                  {fd(e.fromDate)} → <b>{fd(e.toDate)}</b>
                </span>
                <span className="ml-auto text-muted">{when(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">এখনো কোনো রিনিউ হয়নি।</p>
        )}
      </Card>
    </div>
  );
}

function SettingsInner() {
  const me = useMe();
  const admin = isAdmin(me?.role);
  const superAdmin = me?.role === "SUPER_ADMIN";
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabs: { value: Tab; label: string }[] = [
    { value: "rules", label: "নিয়ম ও রেট" },
    { value: "importers", label: "ইম্পোর্টার" },
    { value: "agents", label: "শিপিং এজেন্ট" },
    ...(admin ? [{ value: "users" as Tab, label: superAdmin ? "ইউজার অ্যাকাউন্ট" : "অপারেটর অ্যাকাউন্ট" }] : []),
    ...(superAdmin ? [{ value: "subscription" as Tab, label: "সাবস্ক্রিপশন" }] : []),
  ];
  const asked = sp.get("tab") as Tab | null;
  const tab: Tab = asked && tabs.some((t) => t.value === asked) ? asked : "rules";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const guides: Record<Tab, { steps: string[]; note: string }> = {
    rules: {
      steps: [
        "ডিফল্ট সিকিউরিটি: নতুন জবে প্রতি কন্টেইনারের এই রেট নিজে থেকে বসে। আলাদা রেট লাগলে জবের ফর্মেই বদলাবেন।",
        "সার্ভে লেট: ডিপো রিসিভিংয়ের পর এত দিনের বেশি গেলেও সার্ভে না এলে জব লাল হবে।",
        "হিসাব লেট: সার্ভে রিপোর্টের পর এত দিন বা বেশি গেলেও এজেন্টের হিসাব না এলে লাল হবে।",
        "ওভারডিউ: এজেন্টকে জমার পর এত দিনের বেশি গেলেও রিলিজ না হলে লাল হবে। সংখ্যা বদলে \"সেভ করুন\" চাপুন।",
      ],
      note: "এই নিয়ম শুধু অ্যাডমিন আর সুপার অ্যাডমিন বদলাতে পারেন।",
    },
    importers: {
      steps: [
        "উপরের ঘরে নাম ইংরেজিতে লিখে \"যোগ করুন\" চাপুন, যেমন Rahman Steel।",
        "বানান ভুল হলে \"নাম বদলান\" চেপে ঠিক করুন। পুরোনো সব জবেও নাম বদলে যাবে।",
        "যার সাথে আর কাজ হয় না, তাকে \"লিস্ট থেকে লুকান\"। পুরোনো জব আর স্টেটমেন্টে থাকবে।",
        "নতুন জবের ফর্ম থেকেও \"+\" বাটন চেপে ইম্পোর্টার যোগ করা যায়।",
      ],
      note: "লুকানো আর চালু করা শুধু অ্যাডমিন পারেন।",
    },
    agents: {
      steps: [
        "ক্লায়েন্টের ৯টা শিপিং এজেন্ট আগে থেকেই দেওয়া আছে।",
        "নতুন এজেন্ট লাগলে নাম লিখে \"যোগ করুন\" চাপুন।",
        "বানান ঠিক করতে \"নাম বদলান\", পুরোনো এজেন্ট সরাতে \"লিস্ট থেকে লুকান\"।",
        "নতুন জবের ফর্ম থেকেও \"+\" বাটন চেপে এজেন্ট যোগ করা যায়।",
      ],
      note: "লুকানো এজেন্ট নতুন জবে আসবে না, পুরোনো জবে থাকবে।",
    },
    users: superAdmin
      ? {
          steps: [
            "নাম, ইমেইল, পাসওয়ার্ড আর রোল দিয়ে \"অ্যাকাউন্ট খুলুন\" চাপুন। ইমেইল আর পাসওয়ার্ড তাঁকে দিয়ে দিন।",
            "প্রত্যেক অ্যাডমিন শুরুতে ১টা অপারেটর খুলতে পারেন। পাশের − / + দিয়ে সীমা কমাতে বাড়াতে পারেন।",
            "অ্যাডমিন আরও অপারেটর চাইলে অনুরোধ আসে। \"অনুমতি দিন\" চাপলে তাঁর সীমা ১ বাড়বে।",
            "কেউ চলে গেলে \"বন্ধ করুন\" চাপুন। তাঁর আগের কাজের ইতিহাস থেকে যাবে।",
          ],
          note: "সুপার অ্যাডমিন একজনই। তাঁর ইমেইল-পাসওয়ার্ড Vercel-এর সেটিং থেকে বদলাতে হয়।",
        }
      : {
          steps: [
            "উপরের বক্সে দেখুন কয়টা অপারেটর খুলতে পারবেন আর কয়টা খোলা হয়েছে।",
            "জায়গা থাকলে নাম, ইমেইল, পাসওয়ার্ড দিয়ে \"অ্যাকাউন্ট খুলুন\" চাপুন। নতুন অ্যাকাউন্ট অপারেটর হবে।",
            "সীমা শেষ হলে \"আরও একটার অনুমতি চান\" চাপুন। সুপার অ্যাডমিন অনুমতি দিলে আরেকটা খুলতে পারবেন।",
            "কেউ পাসওয়ার্ড ভুলে গেলে \"পাসওয়ার্ড বদলান\", কেউ চলে গেলে \"বন্ধ করুন\"।",
          ],
          note: "আপনি শুধু নিজের খোলা অপারেটর দেখতে আর সামলাতে পারেন।",
        },
    subscription: {
      steps: [
        "উপরে দেখুন সাবস্ক্রিপশন কত দিন বাকি। ৭ দিন বা কম থাকলে সবার উপরে হলুদ সতর্কবার্তা আসে।",
        "অটো-রিনিউ চালু রাখলে মেয়াদ শেষের দিন নিজে থেকে পরের মেয়াদ শুরু হয়।",
        "\"এখনই বাড়ান\" চাপলে এক মেয়াদ (যেমন ১ মাস) সাথে সাথে বেড়ে যায়।",
        "মেয়াদ শেষ হলে আর অটো-রিনিউ বন্ধ থাকলে আপনি ছাড়া কেউ কাজ করতে পারবেন না, তবে ডেটা সেভ থাকে।",
      ],
      note: "এখানে টাকা নেওয়ার ব্যবস্থা নেই; ফি শুধু মনে রাখার জন্য লেখা থাকে।",
    },
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="সেটিংস" subtitle="লাল মার্কের নিয়ম, ডিফল্ট রেট, ইম্পোর্টার, শিপিং এজেন্ট, অ্যাকাউন্ট আর সাবস্ক্রিপশন" />
      <Segmented value={tab} onChange={setTab} options={tabs} />
      <Guide steps={guides[tab].steps} note={guides[tab].note} />
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
