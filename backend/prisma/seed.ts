/**
 * Seeds settings, the client's importers and shipping agents, and the first admin.
 * Set SEED_DEMO=true to also add sample jobs (for testing only, never on the live database).
 */
import { ContainerSize, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const IMPORTERS = [
  'Anwar Ispat',
  'Montaha Steel',
  'Salam',
  'Anwar Galvanizing',
];
const AGENTS = [
  'APL Bangladesh Pvt Ltd',
  'MSC Mediterranean Shipping',
  'COSCO',
  'Reliance Shipping',
  'Maersk Line Bangladesh',
  'Ocean Network Express (ONE)',
  'PIL Bangladesh Ltd',
  'Hapag-Lloyd',
  'SITC Bangladesh',
];

const dhakaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(
    new Date(),
  );
const daysAgo = (n: number) => {
  const d = new Date(dhakaToday() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

async function main() {
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  for (const name of IMPORTERS)
    await prisma.importer.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  for (const name of AGENTS)
    await prisma.shippingAgent.upsert({
      where: { name },
      update: {},
      create: { name },
    });

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({
        data: {
          name: process.env.ADMIN_NAME || 'Admin',
          email,
          role: 'ADMIN',
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      console.log(`Admin created: ${email}`);
    }
  } else {
    console.log(
      'ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin user created.',
    );
  }

  if (process.env.SEED_DEMO === 'true' && (await prisma.job.count()) === 0) {
    const imp = Object.fromEntries(
      (await prisma.importer.findMany()).map((i) => [i.name, i.id]),
    );
    const ag = Object.fromEntries(
      (await prisma.shippingAgent.findMany()).map((a) => [a.name, a.id]),
    );
    const rows: [
      string,
      string,
      string,
      string,
      number,
      ContainerSize,
      number,
      Partial<Record<string, number>>,
      number?,
    ][] = [
      [
        'JOB-2401',
        '254777',
        'Anwar Ispat',
        'APL Bangladesh Pvt Ltd',
        10,
        'FT20',
        10000,
        { depot: 13 },
      ],
      [
        'JOB-2402',
        '254812',
        'Montaha Steel',
        'APL Bangladesh Pvt Ltd',
        4,
        'FT40',
        10000,
        { depot: 18, survey: 14, submit: 13 },
      ],
      [
        'JOB-2403',
        '253990',
        'Anwar Ispat',
        'COSCO',
        10,
        'FT20',
        10000,
        { depot: 40, survey: 36, submit: 35, bill: 30 },
        85000,
      ],
      [
        'JOB-2404',
        '254105',
        'Salam',
        'PIL Bangladesh Ltd',
        3,
        'FT20',
        8000,
        { depot: 28, survey: 24, submit: 23, bill: 18, release: 8 },
        31500,
      ],
      [
        'JOB-2405',
        '254901',
        'Anwar Galvanizing',
        'Maersk Line Bangladesh',
        6,
        'FT20',
        10000,
        { depot: 5 },
      ],
      [
        'JOB-2406',
        '254433',
        'Montaha Steel',
        'MSC Mediterranean Shipping',
        2,
        'FT40',
        10000,
        { depot: 20, survey: 16, submit: 15, bill: 10 },
        14000,
      ],
      [
        'JOB-2407',
        '254620',
        'Salam',
        'APL Bangladesh Pvt Ltd',
        5,
        'FT20',
        5000,
        { depot: 12, survey: 9, submit: 8 },
      ],
      [
        'JOB-2408',
        '254210',
        'Anwar Galvanizing',
        'COSCO',
        8,
        'FT20',
        10000,
        { depot: 30, survey: 26, submit: 25, bill: 20 },
        96500,
      ],
      [
        'JOB-2409',
        '252876',
        'Anwar Ispat',
        'APL Bangladesh Pvt Ltd',
        4,
        'FT20',
        10000,
        { depot: 60, survey: 55, submit: 54, bill: 47, release: 30 },
        31000,
      ],
      [
        'JOB-2410',
        '254350',
        'Anwar Ispat',
        'PIL Bangladesh Ltd',
        6,
        'FT20',
        10000,
        { depot: 22, survey: 18, submit: 17, bill: 12 },
        52000,
      ],
      [
        'JOB-2411',
        '254702',
        'Montaha Steel',
        'APL Bangladesh Pvt Ltd',
        3,
        'FT40',
        10000,
        { depot: 9, survey: 6 },
      ],
      [
        'JOB-2412',
        '254555',
        'Anwar Ispat',
        'APL Bangladesh Pvt Ltd',
        5,
        'FT20',
        10000,
        { depot: 16, survey: 12, submit: 11, bill: 6 },
        47500,
      ],
    ];
    const at = (n?: number) => (n === undefined ? null : daysAgo(n));
    for (const [jobNo, cNumber, i, a, qty, size, rate, d, cost] of rows) {
      await prisma.job.create({
        data: {
          jobNo,
          cNumber,
          importerId: imp[i],
          agentId: ag[a],
          containerCount: qty,
          containerSize: size,
          ratePerContainer: rate,
          depotReceivedAt: at(d.depot),
          surveyReceivedAt: at(d.survey),
          submittedToAgentAt: at(d.submit),
          agentBillAt: at(d.bill),
          actualCost: cost ?? null,
          releasedAt: at(d.release),
        },
      });
    }
    console.log(`Demo jobs added: ${rows.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
