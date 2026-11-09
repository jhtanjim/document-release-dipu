# লাইভে তোলা (Production)

তিনটা অংশ, তিন জায়গায়:

| অংশ | কোথায় (সাজেশন) | খরচ |
| --- | --- | --- |
| ডাটাবেজ (PostgreSQL) | [Neon](https://neon.tech) | ফ্রি প্ল্যানে শুরু করা যায়, অটো ব্যাকআপ |
| Backend (NestJS) | [Render](https://render.com) বা [Railway](https://railway.app) | Render ফ্রি প্ল্যানে ১৫ মিনিট কেউ না চালালে ঘুমিয়ে যায়, প্রথম লোড ধীর; অফিসের কাজে মাসিক পেইড প্ল্যান ভালো |
| Frontend (Next.js) | [Vercel](https://vercel.com) | ফ্রি |

## ১. ডাটাবেজ (Neon)

1. Neon-এ নতুন প্রজেক্ট খুলুন, রিজিয়ন Singapore দিন (বাংলাদেশের কাছে)।
2. Connection string কপি করুন। এটাই `DATABASE_URL`।

## ২. Backend (Render)

1. New → Web Service → GitHub রিপো `document-release-dipu` কানেক্ট করুন।
2. **Root Directory:** `backend`
3. **Build Command:** `npm ci && npm run build && npx prisma migrate deploy`
4. **Start Command:** `node dist/main`
5. **Environment Variables:**
   - `DATABASE_URL` = Neon-এর লিংক
   - `JWT_SECRET` = লম্বা র‍্যান্ডম লেখা (`node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`)
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = Vercel-এর লিংক (ধাপ ৩-এর পরে বসাবেন)
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` = প্রথম অ্যাডমিনের তথ্য
   - `SEED_DEMO` = `false`
6. Deploy হলে Render-এর Shell থেকে একবার চালান: `npm run db:seed`। এতে নিয়ম, ৪ ইম্পোর্টার, ৯ শিপিং এজেন্ট আর প্রথম অ্যাডমিন তৈরি হবে।
7. চেক: `https://<backend-লিংক>/api/health` খুললে `{"ok":true}` আসবে।

## ৩. Frontend (Vercel)

1. Vercel → Add New → Project → একই রিপো।
2. **Root Directory:** `frontend` (Framework: Next.js নিজে ধরবে)
3. **Environment Variable:** `API_URL` = Render-এর backend লিংক (শেষে `/api` ছাড়া)
4. Deploy।
5. Render-এ ফিরে `FRONTEND_URL`-এ এই Vercel লিংক বসিয়ে backend আবার deploy করুন।

## ৪. চালুর পরে

- প্রথম অ্যাডমিন দিয়ে লগইন করে **সেটিংস → ইউজার** থেকে বাকিদের অ্যাকাউন্ট খুলুন, তারপর সেটিংস থেকে অ্যাডমিনের পাসওয়ার্ড বদলে নিন।
- **সেটিংস → নিয়ম ও রেট**-এ ডিফল্ট রেট আর ৭/৭/৩০ দিনের সীমা ক্লায়েন্টের কথামতো মিলিয়ে নিন।
- আগে আলাদা একটা স্টেজিং (টেস্ট) ডাটাবেজ আর লিংকে ক্লায়েন্টকে ১-২ সপ্তাহ চালাতে দিন, তারপর আসল ডেটা তুলুন।

## পরে কোড বদলালে

- GitHub-এ push করলে Vercel আর Render নিজে থেকেই নতুন ভার্সন তোলে।
- ডাটাবেজের গঠন বদলালে লোকালি `npm run db:migrate -- --name <কী বদলালেন>` চালিয়ে `backend/prisma/migrations` সহ push করুন; Render-এর build-এ `prisma migrate deploy` সেটা লাইভ ডাটাবেজে বসাবে।
