import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Messages are written in Bangla where they are thrown. When the app runs in English
 * (the frontend sends `x-lang: en`), this filter swaps each message for its English text.
 */
const EXACT: Record<string, string> = {
  'অপারেটর কোন অ্যাডমিনের অধীনে থাকবেন, সেটা বাছাই করুন।':
    'Choose the admin this operator works under.',
  'বাছাই করা অ্যাডমিন পাওয়া যায়নি।':
    'The chosen admin was not found or is disabled.',
  'লগইন সেশন শেষ হয়ে গেছে। আবার লগইন করুন।':
    'Your session has ended. Please log in again.',
  'সফটওয়্যারের সাবস্ক্রিপশনের মেয়াদ শেষ। চালু করতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।':
    'The software subscription has expired. Please contact the super admin to renew it.',
  'এই কাজটা শুধু অ্যাডমিন করতে পারেন।': 'Only an admin can do this.',
  'এই কাজটা শুধু সুপার অ্যাডমিন করতে পারেন।':
    'Only the super admin can do this.',
  'সঠিক ইমেইল দিন।': 'Enter a valid email address.',
  'পাসওয়ার্ড দিন।': 'Enter your password.',
  'ইমেইল বা পাসওয়ার্ড মেলেনি।': 'Email or password is incorrect.',
  'নাম দিন।': 'Enter a name.',
  'ইম্পোর্টারের নাম ইংরেজিতে লিখুন।': 'Write the importer name in English.',
  'লুকানো বা চালু করা শুধু অ্যাডমিন করতে পারেন।':
    'Only an admin can hide or restore names.',
  'তারিখ YYYY-MM-DD আকারে দিন।': 'Enter dates as YYYY-MM-DD.',
  'জব নম্বর দিন।': 'Enter the job number.',
  'C নম্বরে শুধু সংখ্যা দিন, যেমন 254777।':
    'C number must be digits only, e.g. 254777.',
  'ইম্পোর্টার বাছাই করুন।': 'Choose an importer.',
  'শিপিং এজেন্ট বাছাই করুন।': 'Choose a shipping agent.',
  'কন্টেইনার সংখ্যা কমপক্ষে ১।': 'At least 1 container.',
  'কন্টেইনার সাইজ ২০ বা ৪০ ফুট।': 'Container size must be 20 or 40 ft.',
  'রেট ০ বা তার বেশি হতে হবে।': 'Rate must be 0 or more.',
  'খরচ ০ বা তার বেশি হতে হবে।': 'Cost must be 0 or more.',
  'জব পাওয়া যায়নি।': 'Job not found.',
  'হিসাবের তারিখ দিলে আসল খরচও লিখুন।':
    'With a bill date, also enter the actual cost.',
  'আসল খরচ লিখলে হিসাবের তারিখও দিন।':
    'With an actual cost, also enter the bill date.',
  'ইম্পোর্টার পাওয়া যায়নি।': 'Importer not found.',
  'শিপিং এজেন্ট পাওয়া যায়নি।': 'Shipping agent not found.',
  'এই C নম্বর আরেকটা জবে আগেই আছে।':
    'This C number is already used by another job.',
  'এই জব নম্বর আগেই আছে।': 'This job number already exists.',
  'অনুমতি চাইতে পারেন শুধু অ্যাডমিন।': 'Only an admin can ask for permission.',
  'আপনার একটা অনুরোধ আগেই অপেক্ষায় আছে। সুপার অ্যাডমিনের উত্তরের অপেক্ষা করুন।':
    'You already have a request waiting. Please wait for the super admin to answer.',
  'অনুরোধ পাওয়া যায়নি।': 'Request not found.',
  'এই অনুরোধের সিদ্ধান্ত আগেই দেওয়া হয়েছে।':
    'This request has already been decided.',
  'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।':
    'Password must be at least 8 characters.',
  'রোল হবে অ্যাডমিন বা অপারেটর।': 'Role must be admin or operator.',
  'অ্যাডমিন শুধু নিজের খোলা অপারেটর অ্যাকাউন্ট সামলাতে পারেন।':
    'An admin can only manage the operator accounts they opened.',
  'এই ইমেইলে আগেই একজন ইউজার আছেন।': 'A user with this email already exists.',
  'ইউজার পাওয়া যায়নি।': 'User not found.',
  'সুপার অ্যাডমিনকে বন্ধ করা বা রোল বদলানো যাবে না। শুধু নাম আর পাসওয়ার্ড বদলানো যায়।':
    "The super admin can't be disabled or change role; only name and password can change.",
  'নিজেকে বন্ধ করা যাবে না।': "You can't disable your own account.",
};

const STEP: Record<string, string> = {
  'ডিপো রিসিভিং': 'Depot receiving',
  'সার্ভে রিপোর্ট': 'Survey report',
  'এজেন্টে জমা': 'Submitted to agent',
  'এজেন্টের হিসাব': "Agent's bill",
  রিলিজ: 'Release',
};
const KIND: Record<string, string> = {
  ইম্পোর্টার: 'An importer',
  'শিপিং এজেন্ট': 'A shipping agent',
};
const KIND_NF: Record<string, string> = {
  ইম্পোর্টার: 'Importer',
  'শিপিং এজেন্ট': 'Shipping agent',
};
const bnDigits = (s: string) =>
  s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [
    /^(.+)-এর তারিখ (.+)-এর আগে হতে পারে না।$/,
    (m) => `${STEP[m[1]] ?? m[1]} date can't be before ${STEP[m[2]] ?? m[2]}.`,
  ],
  [
    /^এই নামে (.+) আগেই আছে।$/,
    (m) => `${KIND[m[1]] ?? m[1]} with this name already exists.`,
  ],
  [/^(.+) পাওয়া যায়নি।$/, (m) => `${KIND_NF[m[1]] ?? m[1]} not found.`],
  [
    /^আপনি (\S+)টা অপারেটর অ্যাকাউন্ট খুলতে পারেন, .*$/,
    (m) =>
      `You can open ${bnDigits(m[1])} operator account(s) and all are used. Ask the super admin for permission to open more.`,
  ],
];

export function toEnglish(msg: string) {
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg;
}

@Catch(HttpException)
export class LanguageFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    if (req.headers['x-lang'] !== 'en') {
      res.status(status).json(body);
      return;
    }
    if (typeof body === 'string') {
      res.status(status).json({ statusCode: status, message: toEnglish(body) });
      return;
    }
    const b = body as { message?: string | string[] };
    const message = Array.isArray(b.message)
      ? b.message.map(toEnglish)
      : typeof b.message === 'string'
        ? toEnglish(b.message)
        : b.message;
    res.status(status).json({ ...b, message });
  }
}
