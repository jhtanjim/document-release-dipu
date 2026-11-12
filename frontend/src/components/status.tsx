"use client";

import type { Job } from "@/lib/types";
import { FLAG_LABEL, STAGE_LABEL, fd, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { Badge } from "./ui";

export function JobStatus({ job }: { job: Job }) {
  const { lang, t } = useLang();
  if (job.flags.length)
    return (
      <div className="flex flex-wrap gap-1">
        {job.flags.map((f) => (
          <Badge key={f.type} tone="crit">
            {FLAG_LABEL[lang][f.type]} · {f.days} {t("দিন", "days")}
          </Badge>
        ))}
      </div>
    );
  if (job.stage === "RELEASED")
    return (
      <Badge tone="good">
        {t("রিলিজড", "Released")} {fd(job.releasedAt)}
      </Badge>
    );
  return <Badge tone="info">{STAGE_LABEL[lang][job.stage]}</Badge>;
}

export function Balance({ value }: { value: number | null }) {
  const { t } = useLang();
  if (value === null)
    return (
      <span className="inline-block whitespace-nowrap rounded-md bg-crit-bg px-2 py-0.5 text-[13px] font-semibold text-crit">
        {t("Pending · হিসাব আসেনি", "Pending · no bill yet")}
      </span>
    );
  return <span className={`num ${value > 0 ? "text-good" : value < 0 ? "text-warn" : ""}`}>{signed(value)}</span>;
}
