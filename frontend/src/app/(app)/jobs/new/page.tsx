import { JobForm } from "@/components/job-form";
import { PageHeader } from "@/components/ui";

export default function NewJobPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="নতুন জব" subtitle="শুরুতে শুধু ধাপ ১ আর ডিপো রিসিভিং তারিখ দিলেই চলবে। বাকি তারিখ পরে আপডেট করবেন।" />
      <JobForm />
    </div>
  );
}
