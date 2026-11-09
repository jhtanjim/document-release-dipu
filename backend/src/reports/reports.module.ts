import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type { JobView } from '../common/job-view';
import { JobsModule, JobsService } from '../jobs/jobs.module';
import { PrismaService } from '../prisma/prisma.module';

const toInt = ({ value }: { value: unknown }) =>
  value ? Number(value) : undefined;

class DashboardQuery {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeReleased?: boolean;
}

class StatementQuery {
  @IsOptional() @Transform(toInt) @IsInt() importerId?: number;
  @IsOptional() @Transform(toInt) @IsInt() agentId?: number;
}

const FLAG_BN: Record<string, string> = {
  SURVEY_LATE: 'সার্ভে লেট',
  BILL_LATE: 'হিসাব লেট',
  OVERDUE: 'ওভারডিউ',
};
const STAGE_BN: Record<string, string> = {
  NEW: 'নতুন',
  DEPOT: 'ডিপো রিসিভড',
  SURVEY: 'সার্ভে এসেছে',
  WITH_AGENT: 'এজেন্টের কাছে',
  BILLED: 'হিসাব এসেছে',
  RELEASED: 'রিলিজড',
};
const dmy = (s: string | null) =>
  s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : '';

function totals(items: JobView[]) {
  const plus = items
    .filter((j) => (j.balance ?? 0) > 0)
    .reduce((a, j) => a + j.balance!, 0);
  const minus = items
    .filter((j) => (j.balance ?? 0) < 0)
    .reduce((a, j) => a + j.balance!, 0);
  return {
    plus,
    minus,
    net: plus + minus,
    pending: items.filter((j) => j.balance === null).length,
    jobs: items.length,
  };
}

function byImporter(items: JobView[]) {
  const m = new Map<
    number,
    { importerId: number; name: string; sum: number; count: number }
  >();
  for (const j of items) {
    const g = m.get(j.importer.id) ?? {
      importerId: j.importer.id,
      name: j.importer.name,
      sum: 0,
      count: 0,
    };
    g.sum += j.balance!;
    g.count++;
    m.set(j.importer.id, g);
  }
  return [...m.values()].sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum));
}

@Controller('reports')
export class ReportsController {
  constructor(
    private jobs: JobsService,
    private prisma: PrismaService,
  ) {}

  @Get('dashboard')
  async dashboard(@Query() q: DashboardQuery) {
    const { today, items } = await this.jobs.list();
    const settings = await this.jobs.rules();
    const has = (t: string) =>
      items.filter((j) => j.flags.some((f) => f.type === t)).length;
    const money = items.filter(
      (j) => j.balance !== null && (q.includeReleased || !j.releasedAt),
    );
    const plus = money.filter((j) => j.balance! > 0);
    const minus = money.filter((j) => j.balance! < 0);
    const worst = (j: JobView) => Math.max(...j.flags.map((f) => f.days));
    return {
      today,
      settings,
      counts: {
        surveyLate: has('SURVEY_LATE'),
        billLate: has('BILL_LATE'),
        overdue: has('OVERDUE'),
        open: items.filter((j) => !j.releasedAt).length,
        total: items.length,
      },
      plusTotal: plus.reduce((a, j) => a + j.balance!, 0),
      minusTotal: minus.reduce((a, j) => a + j.balance!, 0),
      plusByImporter: byImporter(plus),
      minusByImporter: byImporter(minus),
      attention: items
        .filter((j) => j.flags.length)
        .sort((a, b) => worst(b) - worst(a)),
    };
  }

  private async statementData(q: StatementQuery) {
    const { today, items } = await this.jobs.list({
      importerId: q.importerId,
      agentId: q.agentId,
    });
    items.sort(
      (a, b) =>
        a.importer.name.localeCompare(b.importer.name) ||
        (a.depotReceivedAt ?? '').localeCompare(b.depotReceivedAt ?? ''),
    );
    return { today, items };
  }

  @Get('statement')
  async statement(@Query() q: StatementQuery) {
    const { today, items } = await this.statementData(q);
    // The importer × shipping agent count table always covers every job, so it doubles as the filter.
    const groups = await this.prisma.job.groupBy({
      by: ['importerId', 'agentId'],
      _count: { _all: true },
    });
    const impIds = [...new Set(groups.map((g) => g.importerId))];
    const agIds = [...new Set(groups.map((g) => g.agentId))];
    const [importers, agents] = await Promise.all([
      this.prisma.importer.findMany({
        where: { id: { in: impIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.shippingAgent.findMany({
        where: { id: { in: agIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      today,
      items,
      totals: totals(items),
      matrix: {
        importers,
        agents,
        cells: groups.map((g) => ({
          importerId: g.importerId,
          agentId: g.agentId,
          count: g._count._all,
        })),
      },
    };
  }

  @Get('statement.xlsx')
  async statementXlsx(@Query() q: StatementQuery, @Res() res: Response) {
    const { today, items } = await this.statementData(q);
    const t = totals(items);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');
    ws.columns = [
      { header: 'জব নং', key: 'jobNo', width: 14 },
      { header: 'C নং', key: 'cNumber', width: 10 },
      { header: 'ইম্পোর্টার', key: 'importer', width: 20 },
      { header: 'শিপিং এজেন্ট', key: 'agent', width: 28 },
      { header: 'কন্টেইনার', key: 'containers', width: 10 },
      { header: 'জব রিসিভ', key: 'depot', width: 12 },
      { header: 'সার্ভে', key: 'survey', width: 12 },
      { header: 'এজেন্টে জমা', key: 'submit', width: 12 },
      { header: 'হিসাব জমা', key: 'bill', width: 12 },
      { header: 'সিকিউরিটি', key: 'security', width: 12 },
      { header: 'আসল খরচ', key: 'cost', width: 12 },
      { header: 'অ্যামাউন্ট', key: 'amount', width: 14 },
      { header: 'অবস্থা', key: 'status', width: 26 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const j of items) {
      const row = ws.addRow({
        jobNo: j.jobNo,
        cNumber: j.cNumber ?? '',
        importer: j.importer.name,
        agent: j.agent.name,
        containers: `${j.containerCount}×${j.containerSize}`,
        depot: dmy(j.depotReceivedAt),
        survey: dmy(j.surveyReceivedAt),
        submit: dmy(j.submittedToAgentAt),
        bill: dmy(j.agentBillAt),
        security: j.security,
        cost: j.actualCost ?? '',
        amount: j.balance ?? 'Pending (হিসাব আসেনি)',
        status: j.flags.length
          ? j.flags.map((f) => `${FLAG_BN[f.type]} ${f.days} দিন`).join(', ')
          : STAGE_BN[j.stage] + (j.releasedAt ? ` ${dmy(j.releasedAt)}` : ''),
      });
      const amount = row.getCell('amount');
      amount.font = {
        color: {
          argb:
            j.balance === null
              ? 'FFBD2329'
              : j.balance > 0
                ? 'FF1D7340'
                : j.balance < 0
                  ? 'FFA9500A'
                  : 'FF000000',
        },
      };
    }
    for (const key of ['security', 'cost', 'amount'])
      ws.getColumn(key).numFmt = '#,##0;-#,##0';
    ws.addRow({});
    ws.addRow({ agent: 'মোট প্লাস (ফেরত পাবো)', amount: t.plus }).font = {
      bold: true,
    };
    ws.addRow({ agent: 'মোট মাইনাস (বাড়তি খরচ)', amount: t.minus }).font = {
      bold: true,
    };
    ws.addRow({ agent: 'নেট', amount: t.net }).font = { bold: true };
    ws.addRow({ agent: 'হিসাব আসেনি', amount: `${t.pending}টা জব` }).font = {
      bold: true,
    };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="statement-${today}.xlsx"`,
    );
    await wb.xlsx.write(res);
    res.end();
  }
}

@Module({ imports: [JobsModule], controllers: [ReportsController] })
export class ReportsModule {}
