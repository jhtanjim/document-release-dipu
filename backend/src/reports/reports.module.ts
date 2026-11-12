import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type { JobView } from '../common/job-view';
import { JobsModule, JobsService } from '../jobs/jobs.module';

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
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeReleased?: boolean;
  @IsOptional() @IsIn(['bn', 'en']) lang?: 'bn' | 'en';
}

/**
 * A job belongs on the statement once its survey report has arrived (the agent's bill follows from
 * there). Released jobs drop off unless asked for; they stay in the database and the job list.
 */
const onStatement = (j: JobView, includeReleased?: boolean) =>
  j.surveyReceivedAt !== null && (includeReleased || j.releasedAt === null);

const FLAG_BN: Record<string, string> = {
  SURVEY_LATE: 'সার্ভে লেট',
  BILL_LATE: 'হিসাব লেট',
  OVERDUE: 'ওভারডিউ',
};
const STAGE_BN: Record<string, string> = {
  NEW: 'ডিপো রিসিভিং বাকি',
  DEPOT: 'ডিপো রিসিভড',
  SURVEY: 'সার্ভে এসেছে',
  WITH_AGENT: 'এজেন্টের কাছে',
  BILLED: 'হিসাব এসেছে',
  RELEASED: 'রিলিজড',
};
const FLAG_EN: Record<string, string> = {
  SURVEY_LATE: 'Survey late',
  BILL_LATE: 'Bill late',
  OVERDUE: 'Overdue',
};
const STAGE_EN: Record<string, string> = {
  NEW: 'Awaiting depot receiving',
  DEPOT: 'Depot received',
  SURVEY: 'Survey received',
  WITH_AGENT: 'With agent',
  BILLED: 'Bill received',
  RELEASED: 'Released',
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
  constructor(private jobs: JobsService) {}

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
    // A job is counted from the day its depot receiving date is entered; jobs typed in
    // ahead of that (from the demo file) wait in their own list.
    const received = items.filter((j) => j.depotReceivedAt !== null);
    const awaitingDepot = items.filter((j) => j.depotReceivedAt === null);
    return {
      today,
      settings,
      counts: {
        surveyLate: has('SURVEY_LATE'),
        billLate: has('BILL_LATE'),
        overdue: has('OVERDUE'),
        open: received.filter((j) => !j.releasedAt).length,
        total: received.length,
        awaitingDepot: awaitingDepot.length,
      },
      awaitingDepot: awaitingDepot.sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      plusTotal: plus.reduce((a, j) => a + j.balance!, 0),
      minusTotal: minus.reduce((a, j) => a + j.balance!, 0),
      plusByImporter: byImporter(plus),
      minusByImporter: byImporter(minus),
      attention: items
        .filter((j) => j.flags.length)
        .sort((a, b) => worst(b) - worst(a)),
    };
  }

  /** Every job that belongs on the statement, before the importer/agent filter. */
  private async statementPool(q: StatementQuery) {
    const { today, items } = await this.jobs.list();
    return {
      today,
      pool: items.filter((j) => onStatement(j, q.includeReleased)),
    };
  }

  private async statementData(q: StatementQuery) {
    const { today, pool } = await this.statementPool(q);
    const items = pool
      .filter(
        (j) =>
          (!q.importerId || j.importer.id === q.importerId) &&
          (!q.agentId || j.agent.id === q.agentId),
      )
      .sort(
        (a, b) =>
          a.importer.name.localeCompare(b.importer.name) ||
          (a.depotReceivedAt ?? '').localeCompare(b.depotReceivedAt ?? ''),
      );
    return { today, pool, items };
  }

  @Get('statement')
  async statement(@Query() q: StatementQuery) {
    const { today, pool, items } = await this.statementData(q);
    // The importer × shipping agent count table covers the whole statement, so it doubles as the filter.
    const cells = new Map<
      string,
      { importerId: number; agentId: number; count: number }
    >();
    const importers = new Map<number, string>();
    const agents = new Map<number, string>();
    for (const j of pool) {
      importers.set(j.importer.id, j.importer.name);
      agents.set(j.agent.id, j.agent.name);
      const key = `${j.importer.id}:${j.agent.id}`;
      const c = cells.get(key) ?? {
        importerId: j.importer.id,
        agentId: j.agent.id,
        count: 0,
      };
      c.count++;
      cells.set(key, c);
    }
    const named = (m: Map<number, string>) =>
      [...m]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return {
      today,
      items,
      totals: totals(items),
      matrix: {
        importers: named(importers),
        agents: named(agents),
        cells: [...cells.values()],
      },
    };
  }

  @Get('statement.xlsx')
  async statementXlsx(@Query() q: StatementQuery, @Res() res: Response) {
    const { today, items } = await this.statementData(q);
    const t = totals(items);
    const en = q.lang === 'en';
    const L = (bn: string, eng: string) => (en ? eng : bn);
    const FLAG = en ? FLAG_EN : FLAG_BN;
    const STAGE = en ? STAGE_EN : STAGE_BN;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');
    ws.columns = [
      { header: L('জব নং', 'Job No'), key: 'jobNo', width: 14 },
      { header: L('C নং', 'C No'), key: 'cNumber', width: 10 },
      { header: L('ইম্পোর্টার', 'Importer'), key: 'importer', width: 20 },
      { header: L('শিপিং এজেন্ট', 'Shipping agent'), key: 'agent', width: 28 },
      { header: L('কন্টেইনার', 'Containers'), key: 'containers', width: 10 },
      { header: L('জব রিসিভ', 'Job received'), key: 'depot', width: 12 },
      { header: L('সার্ভে', 'Survey'), key: 'survey', width: 12 },
      { header: L('এজেন্টে জমা', 'To agent'), key: 'submit', width: 12 },
      { header: L('হিসাব জমা', 'Bill date'), key: 'bill', width: 12 },
      { header: L('সিকিউরিটি', 'Security'), key: 'security', width: 12 },
      { header: L('আসল খরচ', 'Actual cost'), key: 'cost', width: 12 },
      { header: L('অ্যামাউন্ট', 'Amount'), key: 'amount', width: 14 },
      { header: L('অবস্থা', 'Status'), key: 'status', width: 26 },
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
        amount:
          j.balance ?? L('Pending (হিসাব আসেনি)', 'Pending (no bill yet)'),
        status: j.flags.length
          ? j.flags
              .map((f) => `${FLAG[f.type]} ${f.days} ${L('দিন', 'days')}`)
              .join(', ')
          : STAGE[j.stage] + (j.releasedAt ? ` ${dmy(j.releasedAt)}` : ''),
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
    ws.addRow({
      agent: L('মোট প্লাস (ফেরত পাবো)', 'Total plus (refund due)'),
      amount: t.plus,
    }).font = {
      bold: true,
    };
    ws.addRow({
      agent: L('মোট মাইনাস (বাড়তি খরচ)', 'Total minus (extra cost)'),
      amount: t.minus,
    }).font = {
      bold: true,
    };
    ws.addRow({ agent: L('নেট', 'Net'), amount: t.net }).font = { bold: true };
    ws.addRow({
      agent: L('হিসাব আসেনি', 'No bill yet'),
      amount: L(`${t.pending}টা জব`, `${t.pending} jobs`),
    }).font = {
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
