"use client";

import { JobForm } from "@/components/job-form";
import { Guide, PageHeader } from "@/components/ui";
import { useLang } from "@/lib/i18n";

export default function NewJobPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={t("নতুন জব", "New job")}
        subtitle={t("ডেমো ফাইল বা ডিপো রিসিভিং ফাইল হাতে এলে এখানে এন্ট্রি দিন।", "Enter a job here when a demo or depot receiving file arrives.")}
      />
      <Guide
        steps={[
          t("ধাপ ১ পূরণ করুন: জব নম্বর, C নম্বর, ইম্পোর্টার, শিপিং এজেন্ট আর কন্টেইনার।", "Fill step 1: job number, C number, importer, shipping agent and containers."),
          t("লিস্টে নাম না থাকলে পাশের \"+\" চেপে যোগ করুন। ইম্পোর্টারের নাম ইংরেজিতে লিখবেন।", "If a name is missing, press \"+\" to add it. Write importer names in English."),
          t("শুধু ডেমো ফাইল এলে ডিপো রিসিভিং আর সার্ভের ঘর খালি রাখুন।", "For a demo file only, leave the depot receiving and survey dates empty."),
          t("\"জব সেভ করুন\" চাপুন। বাকি তারিখ পরে জব খুলে আপডেট করবেন।", "Press \"Save job\". Add the other dates later from the job page."),
        ]}
        note={t(
          "ডিপো রিসিভিং তারিখ ছাড়া জব মোট জবে গোনা হয় না; সার্ভের তারিখ ছাড়া স্টেটমেন্টে ওঠে না।",
          "A job without a depot receiving date isn't counted in the total; without a survey date it isn't on the statement.",
        )}
      />
      <JobForm />
    </div>
  );
}
