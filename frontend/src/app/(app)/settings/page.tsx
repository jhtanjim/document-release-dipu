"use client";

import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/api";
import type { Importer, Role, Settings, UserRow } from "@/lib/types";
import { Badge, Button, Card, ErrorBox, Field, Loading, PageHeader, Segmented, inputCls } from "@/components/ui";
import { useMe, useToast } from "@/components/shell";

type Tab = "rules" | "importers" | "agents" | "users";

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

function UsersTab() {
  const { data, error, reload } = useApi<UserRow[]>("/users");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "OPERATOR" as Role });
  const [err, setErr] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ id: number; password: string } | null>(null);
  const toast = useToast();
  const me = useMe();

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
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api("/users", { json: f }).then(() => setF({ name: "", email: "", password: "", role: "OPERATOR" })), `${f.name} যোগ হয়েছে`);
        }}
      >
        <input aria-label="নাম" placeholder="নাম" required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input aria-label="ইমেইল" placeholder="ইমেইল" type="email" required className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input aria-label="পাসওয়ার্ড" placeholder="পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)" type="password" minLength={8} required autoComplete="new-password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <select aria-label="রোল" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          <option value="OPERATOR">অপারেটর: এন্ট্রি ও আপডেট</option>
          <option value="ADMIN">অ্যাডমিন: সব কিছু</option>
        </select>
        <Button type="submit" variant="primary">
          ইউজার যোগ করুন
        </Button>
      </form>
      {err && <p className="font-semibold text-crit">{err}</p>}
      <ul className="divide-y divide-line">
        {data.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0">
              <p className={`font-semibold ${u.active ? "" : "text-muted line-through"}`}>{u.name}</p>
              <p className="text-[13px] text-muted">{u.email}</p>
            </div>
            <Badge tone={u.role === "ADMIN" ? "info" : "neutral"}>{u.role === "ADMIN" ? "অ্যাডমিন" : "অপারেটর"}</Badge>
            {!u.active && <Badge tone="crit">বন্ধ</Badge>}
            <span className="ml-auto flex flex-wrap gap-2">
              {resetFor?.id === u.id ? (
                <>
                  <input aria-label="নতুন পাসওয়ার্ড" type="password" autoComplete="new-password" placeholder="নতুন পাসওয়ার্ড" className={`${inputCls} w-48`} value={resetFor.password} onChange={(e) => setResetFor({ ...resetFor, password: e.target.value })} />
                  <Button size="sm" variant="primary" onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { password: resetFor.password } }).then(() => setResetFor(null)), "পাসওয়ার্ড বদলানো হয়েছে")}>
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
              {u.id !== me?.id && (
                <Button size="sm" variant="ghost" onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }), u.active ? "ইউজার বন্ধ করা হয়েছে" : "ইউজার চালু হয়েছে")}>
                  {u.active ? "বন্ধ করুন" : "চালু করুন"}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function SettingsPage() {
  const me = useMe();
  const admin = me?.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("rules");
  const tabs: { value: Tab; label: string }[] = [
    { value: "rules", label: "নিয়ম ও রেট" },
    { value: "importers", label: "ইম্পোর্টার" },
    { value: "agents", label: "শিপিং এজেন্ট" },
    ...(admin ? [{ value: "users" as Tab, label: "ইউজার" }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="সেটিংস" subtitle="লাল মার্কের নিয়ম, ডিফল্ট রেট, ইম্পোর্টার, শিপিং এজেন্ট আর ইউজার" />
      <Segmented value={tab} onChange={setTab} options={tabs} />
      {tab === "rules" && <RulesTab admin={admin} />}
      {tab === "importers" && <NamesTab kind="importers" admin={admin} />}
      {tab === "agents" && <NamesTab kind="agents" admin={admin} />}
      {tab === "users" && admin && <UsersTab />}
    </div>
  );
}
