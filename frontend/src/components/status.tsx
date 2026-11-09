import type { Job } from "@/lib/types";
import { FLAG_LABEL, STAGE_LABEL, fd, signed } from "@/lib/format";
import { Badge } from "./ui";

export function JobStatus({ job }: { job: Job }) {
  if (job.flags.length)
    return (
      <div className="flex flex-wrap gap-1">
        {job.flags.map((f) => (
          <Badge key={f.type} tone="crit">
            {FLAG_LABEL[f.type]} · {f.days} দিন
          </Badge>
        ))}
      </div>
    );
  if (job.stage === "RELEASED") return <Badge tone="good">রিলিজড {fd(job.releasedAt)}</Badge>;
  return <Badge tone="info">{STAGE_LABEL[job.stage]}</Badge>;
}

export function Balance({ value }: { value: number | null }) {
  if (value === null)
    return (
      <span className="inline-block whitespace-nowrap rounded-md bg-crit-bg px-2 py-0.5 text-[13px] font-semibold text-crit">
        Pending · হিসাব আসেনি
      </span>
    );
  return <span className={`num ${value > 0 ? "text-good" : value < 0 ? "text-warn" : ""}`}>{signed(value)}</span>;
}
