"use client";

import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/api";
import { isAdmin, ROLE_LABEL, type Importer, type Settings, type UserRow } from "@/lib/types";

type Assignable = "ADMIN" | "OPERATOR";
import { Badge, Button, Card, ErrorBox, Field, Guide, Loading, PageHeader, Segmented, inputCls } from "@/components/ui";
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
  const [f, setF] = useState({ name: "", email: "", password: "", role: "OPERATOR" as Assignable });
  const [err, setErr] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ id: number; password: string } | null>(null);
  const toast = useToast();
  const me = useMe();
  const superAdmin = me?.role === "SUPER_ADMIN";
  // Super admin manages everyone; an admin manages operators only.
  const canManage = (u: UserRow) => u.role !== "SUPER_ADMIN" && (superAdmin || u.role === "OPERATOR");

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
      <h2 className="font-bold">{superAdmin ? "নতুন অ্যাকাউন্ট খুলুন" : "নতুন অপারেটর অ্যাকাউন্ট খুলুন"}</h2>
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
        {superAdmin ? (
          <select aria-label="রোল" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Assignable })}>
            <option value="OPERATOR">অপারেটর: এন্ট্রি ও আপডেট</option>
            <option value="ADMIN">অ্যাডমিন: রেট, নিয়ম, ডিলিট, অপারেটর খোলা</option>
          </select>
        ) : (
          <p className="flex items-center rounded-lg bg-sunk px-3 text-sm text-muted">রোল: অপারেটর</p>
        )}
        <Button type="submit" variant="primary">
          অ্যাকাউন্ট খুলুন
        </Button>
      </form>
      {err && <p className="font-semibold text-crit">{err}</p>}
      <h2 className="mt-2 font-bold">{superAdmin ? "সব অ্যাকাউন্ট" : "অপারেটর অ্যাকাউন্ট"}</h2>
      {!data.length && <p className="text-muted">এখনো কোনো অ্যাকাউন্ট খোলা হয়নি।</p>}
      <ul className="divide-y divide-line">
        {data.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0">
              <p className={`font-semibold ${u.active ? "" : "text-muted line-through"}`}>{u.name}</p>
              <p className="text-[13px] text-muted">{u.email}</p>
            </div>
            <Badge tone={u.role === "SUPER_ADMIN" ? "good" : u.role === "ADMIN" ? "info" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
            {!u.active && <Badge tone="crit">বন্ধ</Badge>}
            <span className="ml-auto flex flex-wrap gap-2">
              {!canManage(u) && u.id !== me?.id ? null : resetFor?.id === u.id ? (
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
              {u.id !== me?.id && canManage(u) && (
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
  const admin = isAdmin(me?.role);
  const superAdmin = me?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<Tab>("rules");
  const tabs: { value: Tab; label: string }[] = [
    { value: "rules", label: "নিয়ম ও রেট" },
    { value: "importers", label: "ইম্পোর্টার" },
    { value: "agents", label: "শিপিং এজেন্ট" },
    ...(admin ? [{ value: "users" as Tab, label: superAdmin ? "ইউজার অ্যাকাউন্ট" : "অপারেটর অ্যাকাউন্ট" }] : []),
  ];
  const guides: Record<Tab, { steps: string[]; note: string }> = {
    rules: {
      steps: [
        "ডিফল্ট সিকিউরিটি: নতুন জবে প্রতি কন্টেইনারের এই রেট নিজে থেকে বসবে। কোনো জবে আলাদা রেট লাগলে জবের ফর্মেই বদলাবেন।",
        "সার্ভে লেট: ডিপো রিসিভিংয়ের পর এত দিনের বেশি গেলেও সার্ভে না এলে জব লাল হবে।",
        "হিসাব লেট: সার্ভে রিপোর্টের পর এত দিন বা বেশি গেলেও এজেন্টের হিসাব না এলে জব লাল হবে।",
        "ওভারডিউ: এজেন্টকে জমার পর এত দিনের বেশি গেলেও রিলিজ না হলে জব লাল হবে।",
        "সংখ্যা বদলে \"সেভ করুন\" চাপুন। সব জবে সাথে সাথে নতুন নিয়ম খাটবে।",
      ],
      note: "এই নিয়ম শুধু অ্যাডমিন আর সুপার অ্যাডমিন বদলাতে পারেন।",
    },
    importers: {
      steps: [
        "উপরের ঘরে নাম ইংরেজিতে লিখে \"যোগ করুন\" চাপুন, যেমন Rahman Steel।",
        "বানান ভুল হলে \"নাম বদলান\" চেপে ঠিক করুন। পুরোনো সব জবেও নাম বদলে যাবে।",
        "যার সাথে আর কাজ হয় না, তাকে \"লিস্ট থেকে লুকান\"। নতুন জবের লিস্টে আসবে না, কিন্তু পুরোনো জব আর স্টেটমেন্টে থাকবে।",
      ],
      note: "নতুন জবের ফর্ম থেকেও \"+\" বাটন চেপে ইম্পোর্টার যোগ করা যায়।",
    },
    agents: {
      steps: [
        "ক্লায়েন্টের ৯টা শিপিং এজেন্ট আগে থেকেই দেওয়া আছে।",
        "নতুন এজেন্ট লাগলে নাম লিখে \"যোগ করুন\" চাপুন।",
        "বানান ঠিক করতে \"নাম বদলান\", আর পুরোনো এজেন্ট সরাতে \"লিস্ট থেকে লুকান\" চাপুন।",
      ],
      note: "নতুন জবের ফর্ম থেকেও \"+\" বাটন চেপে এজেন্ট যোগ করা যায়।",
    },
    users: superAdmin
      ? {
          steps: [
            "নাম, ইমেইল, পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর) আর রোল দিয়ে \"অ্যাকাউন্ট খুলুন\" চাপুন।",
            "ইমেইল আর পাসওয়ার্ড ওই মানুষটিকে দিয়ে দিন। তিনি এগুলো দিয়ে লগইন করবেন। কেউ নিজে রেজিস্টার করতে পারেন না।",
            "অপারেটর: শুধু জব এন্ট্রি আর আপডেট। অ্যাডমিন: রেট, নিয়ম, জব ডিলিট আর অপারেটর অ্যাকাউন্ট খোলা।",
            "কেউ পাসওয়ার্ড ভুলে গেলে \"পাসওয়ার্ড বদলান\" দিয়ে নতুন পাসওয়ার্ড দিন।",
            "কেউ চলে গেলে \"বন্ধ করুন\" চাপুন। তিনি আর লগইন করতে পারবেন না, কিন্তু তাঁর আগের কাজের ইতিহাস থেকে যাবে।",
          ],
          note: "সুপার অ্যাডমিন একজনই। তাঁকে বন্ধ করা যায় না; ইমেইল বা পাসওয়ার্ড বদলাতে সার্ভারের .env বদলে npm run admin:reset চালাতে হয়।",
        }
      : {
          steps: [
            "নাম, ইমেইল আর পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর) দিয়ে \"অ্যাকাউন্ট খুলুন\" চাপুন। নতুন অ্যাকাউন্ট সবসময় অপারেটর হবে।",
            "ইমেইল আর পাসওয়ার্ড ওই মানুষটিকে দিয়ে দিন। তিনি এগুলো দিয়ে লগইন করবেন।",
            "কেউ পাসওয়ার্ড ভুলে গেলে \"পাসওয়ার্ড বদলান\" দিয়ে নতুন পাসওয়ার্ড দিন।",
            "কেউ চলে গেলে \"বন্ধ করুন\" চাপুন। তিনি আর লগইন করতে পারবেন না।",
          ],
          note: "অ্যাডমিন অ্যাকাউন্ট খোলা বা বদলানো শুধু সুপার অ্যাডমিন করতে পারেন।",
        },
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="সেটিংস" subtitle="লাল মার্কের নিয়ম, ডিফল্ট রেট, ইম্পোর্টার, শিপিং এজেন্ট আর অ্যাকাউন্ট" />
      <Segmented value={tab} onChange={setTab} options={tabs} />
      <Guide id={`settings-${tab}${tab === "users" && superAdmin ? "-super" : ""}`} steps={guides[tab].steps} note={guides[tab].note} />
      {tab === "rules" && <RulesTab admin={admin} />}
      {tab === "importers" && <NamesTab kind="importers" admin={admin} />}
      {tab === "agents" && <NamesTab kind="agents" admin={admin} />}
      {tab === "users" && admin && <UsersTab />}
    </div>
  );
}
