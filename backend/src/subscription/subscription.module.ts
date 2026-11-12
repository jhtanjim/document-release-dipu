import {
  Body,
  Controller,
  Get,
  Global,
  Injectable,
  Module,
  Patch,
  Post,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AllowExpired,
  type AuthUser,
  CurrentUser,
  Roles,
} from '../auth/decorators';
import { dhakaToday, toDate, ymd } from '../common/job-view';
import { PrismaService } from '../prisma/prisma.module';

/** "YYYY-MM-DD" + n months, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
const WARN_DAYS = 7;

class UpdateSubscriptionDto {
  @IsOptional() @IsString() @MaxLength(40) plan?: string;
  @IsOptional() @IsInt() @Min(1) @Max(36) periodMonths?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) amount?:
    number | null;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'তারিখ YYYY-MM-DD আকারে দিন।' })
  endsAt?: string;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
}

@Injectable()
export class SubscriptionService {
  private cache: { at: number; active: boolean } | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * The subscription as of today. With auto-renew on, a period that has ended is renewed here
   * (as many periods as needed), so it never lapses while auto-renew stays on.
   */
  async current() {
    const today = dhakaToday();
    let s = await this.prisma.subscription.findUnique({ where: { id: 1 } });
    if (!s)
      s = await this.prisma.subscription.create({
        data: {
          id: 1,
          startedAt: toDate(today)!,
          endsAt: toDate(addMonths(today, 1))!,
        },
      });
    let ends = ymd(s.endsAt)!;
    if (s.autoRenew && ends < today) {
      let next = ends;
      while (next < today) next = addMonths(next, s.periodMonths);
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: 1 },
          data: { endsAt: toDate(next)! },
        }),
        this.prisma.subscriptionEvent.create({
          data: {
            type: 'RENEW_AUTO',
            fromDate: toDate(ends)!,
            toDate: toDate(next)!,
          },
        }),
      ]);
      ends = next;
      this.cache = null;
    }
    const daysLeft = daysBetween(today, ends);
    const status: SubscriptionStatus =
      daysLeft < 0 ? 'EXPIRED' : daysLeft <= WARN_DAYS ? 'EXPIRING' : 'ACTIVE';
    return {
      plan: s.plan,
      periodMonths: s.periodMonths,
      amount: s.amount,
      startedAt: ymd(s.startedAt),
      endsAt: ends,
      autoRenew: s.autoRenew,
      daysLeft,
      status,
      active: status !== 'EXPIRED',
      today,
    };
  }

  /** Cached for a minute so the login check does not hit the database on every request. */
  async isActive() {
    if (this.cache && Date.now() - this.cache.at < 60_000)
      return this.cache.active;
    const active = (await this.current()).active;
    this.cache = { at: Date.now(), active };
    return active;
  }

  clearCache() {
    this.cache = null;
  }
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private prisma: PrismaService,
    private subs: SubscriptionService,
  ) {}

  @AllowExpired()
  @Get()
  async get(@CurrentUser() me: AuthUser) {
    const s = await this.subs.current();
    if (me.role !== 'SUPER_ADMIN') return s;
    const events = await this.prisma.subscriptionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      ...s,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        fromDate: ymd(e.fromDate),
        toDate: ymd(e.toDate),
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  @Roles('SUPER_ADMIN')
  @Patch()
  async update(
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() me: AuthUser,
  ) {
    const before = await this.subs.current();
    await this.prisma.subscription.update({
      where: { id: 1 },
      data: {
        plan: dto.plan?.trim() || undefined,
        periodMonths: dto.periodMonths,
        amount: dto.amount,
        autoRenew: dto.autoRenew,
        endsAt: dto.endsAt ? toDate(dto.endsAt)! : undefined,
      },
    });
    if (dto.endsAt && dto.endsAt !== before.endsAt)
      await this.prisma.subscriptionEvent.create({
        data: {
          type: 'UPDATE',
          fromDate: toDate(before.endsAt)!,
          toDate: toDate(dto.endsAt)!,
        },
      });
    this.subs.clearCache();
    return this.get(me);
  }

  /** Renew by one period now: from the end date, or from today if it has already run out. */
  @Roles('SUPER_ADMIN')
  @Post('renew')
  async renew(@CurrentUser() me: AuthUser) {
    const s = await this.subs.current();
    const from = s.endsAt >= s.today ? s.endsAt : s.today;
    const to = addMonths(from, s.periodMonths);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: 1 },
        data: { endsAt: toDate(to)! },
      }),
      this.prisma.subscriptionEvent.create({
        data: {
          type: 'RENEW_MANUAL',
          fromDate: toDate(s.endsAt)!,
          toDate: toDate(to)!,
        },
      }),
    ]);
    this.subs.clearCache();
    return this.get(me);
  }
}

@Global()
@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
