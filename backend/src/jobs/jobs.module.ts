import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators';
import {
  dhakaToday,
  JobView,
  sizeFromApi,
  toDate,
  toJobView,
} from '../common/job-view';
import { PrismaService } from '../prisma/prisma.module';
import { SettingsModule, SettingsService } from '../settings/settings.module';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = 'তারিখ YYYY-MM-DD আকারে দিন।';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class JobInputDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'জব নম্বর দিন।' })
  @MaxLength(50)
  jobNo!: string;
  @Transform(blankToNull)
  @IsOptional()
  @Matches(/^\d+$/, { message: 'C নম্বরে শুধু সংখ্যা দিন, যেমন 254777।' })
  @MaxLength(30)
  cNumber?: string | null;
  @IsInt({ message: 'ইম্পোর্টার বাছাই করুন।' }) importerId!: number;
  @IsInt({ message: 'শিপিং এজেন্ট বাছাই করুন।' }) agentId!: number;
  @IsInt()
  @Min(1, { message: 'কন্টেইনার সংখ্যা কমপক্ষে ১।' })
  containerCount!: number;
  @IsIn(['20', '40'], { message: 'কন্টেইনার সাইজ ২০ বা ৪০ ফুট।' })
  containerSize!: '20' | '40';
  @IsInt()
  @Min(0, { message: 'রেট ০ বা তার বেশি হতে হবে।' })
  ratePerContainer!: number;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE, { message: DATE_MSG })
  depotReceivedAt?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE, { message: DATE_MSG })
  surveyReceivedAt?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE, { message: DATE_MSG })
  submittedToAgentAt?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE, { message: DATE_MSG })
  agentBillAt?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0, { message: 'খরচ ০ বা তার বেশি হতে হবে।' })
  actualCost?: number | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE, { message: DATE_MSG })
  releasedAt?: string | null;
  @Transform(blankToNull) @IsOptional() @IsString() @MaxLength(500) note?:
    string | null;
}

class ListQuery {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsInt()
  importerId?: number;
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsInt()
  agentId?: number;
  @IsOptional()
  @IsIn([
    'FLAGGED',
    'SURVEY_LATE',
    'BILL_LATE',
    'OVERDUE',
    'PENDING_BILL',
    'NO_DEPOT',
    'OPEN',
    'RELEASED',
  ])
  status?: string;
  @IsOptional() @IsString() @MaxLength(50) search?: string;
}

const DATE_ORDER = [
  ['depotReceivedAt', 'ডিপো রিসিভিং'],
  ['surveyReceivedAt', 'সার্ভে রিপোর্ট'],
  ['submittedToAgentAt', 'এজেন্টে জমা'],
  ['agentBillAt', 'এজেন্টের হিসাব'],
  ['releasedAt', 'রিলিজ'],
] as const;

const TRACKED = [
  'jobNo',
  'cNumber',
  'importerId',
  'agentId',
  'containerCount',
  'containerSize',
  'ratePerContainer',
  'depotReceivedAt',
  'surveyReceivedAt',
  'submittedToAgentAt',
  'agentBillAt',
  'actualCost',
  'releasedAt',
  'note',
] as const;

const include = { importer: true, agent: true } as const;

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async rules() {
    return this.settings.get();
  }

  /** Every job as a computed view; filters on red marks run after the dates are evaluated. */
  async list(q: ListQuery = {}): Promise<{ today: string; items: JobView[] }> {
    const today = dhakaToday();
    const rules = await this.rules();
    const where: Prisma.JobWhereInput = {
      importerId: q.importerId,
      agentId: q.agentId,
      ...(q.search?.trim()
        ? {
            OR: [
              { jobNo: { contains: q.search.trim(), mode: 'insensitive' } },
              { cNumber: { contains: q.search.trim() } },
            ],
          }
        : {}),
    };
    const jobs = await this.prisma.job.findMany({
      where,
      include,
      orderBy: [
        { depotReceivedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
    });
    let items = jobs.map((j) => toJobView(j, rules, today));
    const has = (v: JobView, t: string) => v.flags.some((f) => f.type === t);
    const filters: Record<string, (v: JobView) => boolean> = {
      FLAGGED: (v) => v.flags.length > 0,
      SURVEY_LATE: (v) => has(v, 'SURVEY_LATE'),
      BILL_LATE: (v) => has(v, 'BILL_LATE'),
      OVERDUE: (v) => has(v, 'OVERDUE'),
      PENDING_BILL: (v) => v.balance === null,
      NO_DEPOT: (v) => v.depotReceivedAt === null,
      OPEN: (v) => v.depotReceivedAt !== null && v.releasedAt === null,
      RELEASED: (v) => v.releasedAt !== null,
    };
    if (q.status && filters[q.status]) items = items.filter(filters[q.status]);
    return { today, items };
  }

  async get(id: number) {
    const job = await this.prisma.job.findUnique({ where: { id }, include });
    if (!job) throw new NotFoundException('জব পাওয়া যায়নি।');
    const logs = await this.prisma.auditLog.findMany({
      where: { jobId: id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ...toJobView(job, await this.rules()),
      history: logs.map((l) => ({
        id: l.id,
        action: l.action,
        user: l.user?.name ?? null,
        changes: l.changes,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  private check(dto: JobInputDto) {
    if (
      dto.agentBillAt &&
      (dto.actualCost === null || dto.actualCost === undefined)
    )
      throw new BadRequestException('হিসাবের তারিখ দিলে আসল খরচও লিখুন।');
    if (dto.actualCost != null && !dto.agentBillAt)
      throw new BadRequestException('আসল খরচ লিখলে হিসাবের তারিখও দিন।');
    let prev: (typeof DATE_ORDER)[number] | null = null;
    for (const d of DATE_ORDER) {
      const v = dto[d[0]];
      if (v) {
        if (prev && v < dto[prev[0]]!)
          throw new BadRequestException(
            `${d[1]}-এর তারিখ ${prev[1]}-এর আগে হতে পারে না।`,
          );
        prev = d;
      }
    }
  }

  private data(dto: JobInputDto) {
    return {
      jobNo: dto.jobNo,
      cNumber: dto.cNumber ?? null,
      importerId: dto.importerId,
      agentId: dto.agentId,
      containerCount: dto.containerCount,
      containerSize: sizeFromApi(dto.containerSize),
      ratePerContainer: dto.ratePerContainer,
      depotReceivedAt: toDate(dto.depotReceivedAt),
      surveyReceivedAt: toDate(dto.surveyReceivedAt),
      submittedToAgentAt: toDate(dto.submittedToAgentAt),
      agentBillAt: toDate(dto.agentBillAt),
      actualCost: dto.actualCost ?? null,
      releasedAt: toDate(dto.releasedAt),
      note: dto.note ?? null,
    };
  }

  private async refs(dto: JobInputDto) {
    const [imp, ag] = await Promise.all([
      this.prisma.importer.findUnique({ where: { id: dto.importerId } }),
      this.prisma.shippingAgent.findUnique({ where: { id: dto.agentId } }),
    ]);
    if (!imp) throw new BadRequestException('ইম্পোর্টার পাওয়া যায়নি।');
    if (!ag) throw new BadRequestException('শিপিং এজেন্ট পাওয়া যায়নি।');
  }

  private async unique<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = String(
          (e.meta?.target as string[] | undefined)?.join(',') ?? '',
        );
        throw new ConflictException(
          target.includes('cNumber')
            ? 'এই C নম্বর আরেকটা জবে আগেই আছে।'
            : 'এই জব নম্বর আগেই আছে।',
        );
      }
      throw e;
    }
  }

  /** Comparable snapshot of the tracked fields, used for the change history. */
  private snap(j: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const k of TRACKED) {
      const v = j[k];
      out[k] =
        v instanceof Date
          ? v.toISOString().slice(0, 10)
          : k === 'containerSize'
            ? v === 'FT40'
              ? '40'
              : '20'
            : (v ?? null);
    }
    return out;
  }

  async create(dto: JobInputDto, user: AuthUser) {
    this.check(dto);
    await this.refs(dto);
    const job = await this.unique(() =>
      this.prisma.job.create({ data: this.data(dto), include }),
    );
    await this.prisma.auditLog.create({
      data: {
        jobId: job.id,
        jobNo: job.jobNo,
        userId: user.id,
        action: 'CREATE',
      },
    });
    return toJobView(job, await this.rules());
  }

  async update(id: number, dto: JobInputDto, user: AuthUser) {
    const before = await this.prisma.job.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('জব পাওয়া যায়নি।');
    this.check(dto);
    await this.refs(dto);
    const job = await this.unique(() =>
      this.prisma.job.update({ where: { id }, data: this.data(dto), include }),
    );
    const a = this.snap(before);
    const b = this.snap(job);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of TRACKED)
      if (a[k] !== b[k]) changes[k] = { from: a[k], to: b[k] };
    // Show names instead of ids in the history.
    if (changes.importerId)
      changes.importerId = {
        from: (
          await this.prisma.importer.findUnique({
            where: { id: before.importerId },
          })
        )?.name,
        to: job.importer.name,
      };
    if (changes.agentId)
      changes.agentId = {
        from: (
          await this.prisma.shippingAgent.findUnique({
            where: { id: before.agentId },
          })
        )?.name,
        to: job.agent.name,
      };
    if (Object.keys(changes).length)
      await this.prisma.auditLog.create({
        data: {
          jobId: id,
          jobNo: job.jobNo,
          userId: user.id,
          action: 'UPDATE',
          changes: changes as Prisma.InputJsonValue,
        },
      });
    return toJobView(job, await this.rules());
  }

  async remove(id: number, user: AuthUser) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('জব পাওয়া যায়নি।');
    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          jobId: null,
          jobNo: job.jobNo,
          userId: user.id,
          action: 'DELETE',
          changes: this.snap(
            job as unknown as Record<string, unknown>,
          ) as Prisma.InputJsonValue,
        },
      }),
      this.prisma.job.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}

@Controller('jobs')
export class JobsController {
  constructor(private jobs: JobsService) {}

  @Get()
  list(@Query() q: ListQuery) {
    return this.jobs.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.jobs.get(id);
  }

  @Post()
  create(@Body() dto: JobInputDto, @CurrentUser() user: AuthUser) {
    return this.jobs.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JobInputDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.jobs.update(id, dto, user);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.jobs.remove(id, user);
  }
}

@Module({
  imports: [SettingsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
