# গারান্টি রিলিজ ট্র্যাকার

প্রতিটা জবের গারান্টি (সিকিউরিটি মানি) ট্র্যাক করার সফটওয়্যার: ডিপো রিসিভিং → সার্ভে → শিপিং এজেন্টকে জমা → এজেন্টের হিসাব → রিলিজ। দেরি হলে জব নিজে থেকে লাল হয়, আর এজেন্টের হিসাব এলে প্লাস/মাইনাস অটো হিসাব হয়।

| ফোল্ডার | কী |
| --- | --- |
| `frontend/` | Next.js 15 (App Router, TypeScript, Tailwind) — ইউজার যা দেখেন |
| `backend/` | NestJS 11 + Prisma + PostgreSQL — API, লগইন, হিসাব |
| `index.html`, `prototype/` | ক্লায়েন্টকে দেখানোর পুরোনো স্যাম্পল (https://document-release-dipu.vercel.app) |
| `DEPLOY.md` | লাইভে তোলার ধাপ |

## ফিচার

- **লগইন ও রোল:** অ্যাডমিন (সব কিছু, রেট/নিয়ম, ডিলিট, ইউজার) আর অপারেটর (জব এন্ট্রি ও আপডেট)।
- **জব:** জব নং, C নং (শুধু সংখ্যা, ইউনিক), ইম্পোর্টার (ইংরেজিতে), শিপিং এজেন্ট, কন্টেইনার × রেট, ৫টা তারিখ, আসল খরচ, নোট।
- **লাল মার্ক:** সার্ভে লেট (ডিপোর ৭ দিনের বেশি), হিসাব লেট (সার্ভের ৭ দিন বা বেশি), ওভারডিউ (এজেন্টে জমার ৩০ দিনের বেশি)। দিনের সীমা সেটিংস থেকে বদলানো যায়। বাংলাদেশের তারিখ (Asia/Dhaka) ধরে প্রতিবার নতুন করে হিসাব হয়, ডেটাবেজে লেখা থাকে না।
- **ড্যাশবোর্ড:** লাল জবের সংখ্যা, মোট প্লাস/মাইনাস, ইম্পোর্টার অনুযায়ী গ্রুপ, "এখনই দেখতে হবে" লিস্ট।
- **স্টেটমেন্ট:** ইম্পোর্টার × শিপিং এজেন্ট জব-সংখ্যার টেবিল (ক্লিক করলে ফিল্টার), ইম্পোর্টার আর এজেন্ট ফিল্টার, Excel ডাউনলোড, প্রিন্ট/PDF।
- **পরিবর্তনের ইতিহাস:** প্রতিটা জবে কে কবে কোন ঘর বদলালেন।
- **সেটিংস:** ডিফল্ট রেট ও দিনের নিয়ম, ইম্পোর্টার ও এজেন্ট লিস্ট, ইউজার যোগ/বন্ধ/পাসওয়ার্ড।

## লোকালি চালানো

দরকার: Node.js 20+ আর PostgreSQL।

```bash
# 1. Backend
cd backend
cp .env.example .env        # DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD পূরণ করুন
npm install
npm run db:migrate          # টেবিল তৈরি
npm run db:seed             # সেটিংস, ৪ ইম্পোর্টার, ৯ এজেন্ট, প্রথম অ্যাডমিন (SEED_DEMO=true দিলে ১২টা নমুনা জবও)
npm run start:dev           # http://localhost:4000/api

# 2. Frontend (আরেকটা টার্মিনালে)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

npm 11+ প্রথমবার Prisma আর esbuild-এর install script চালানোর অনুমতি চাইতে পারে; `backend/package.json`-এর `allowScripts`-এ সেগুলো আগেই দেওয়া আছে।

## API (সংক্ষেপে)

সব রাউট `/api` দিয়ে শুরু, `health` আর `auth/login` ছাড়া সবগুলোতে লগইন লাগে।

| রাউট | কাজ |
| --- | --- |
| `POST auth/login`, `POST auth/logout`, `GET auth/me` | লগইন (httpOnly কুকি) |
| `GET/POST jobs`, `GET/PATCH/DELETE jobs/:id` | জব; `GET jobs?importerId&agentId&status&search` |
| `GET/POST importers`, `PATCH importers/:id` | ইম্পোর্টার |
| `GET/POST agents`, `PATCH agents/:id` | শিপিং এজেন্ট |
| `GET/PATCH settings` | ডিফল্ট রেট আর দিনের নিয়ম (PATCH শুধু অ্যাডমিন) |
| `GET reports/dashboard`, `GET reports/statement`, `GET reports/statement.xlsx` | রিপোর্ট |
| `GET/POST users`, `PATCH users/:id` | ইউজার (শুধু অ্যাডমিন) |
