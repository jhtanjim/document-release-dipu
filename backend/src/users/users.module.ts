import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';

const PASSWORD_MSG = 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।';
/** There is exactly one super admin (set from .env); accounts made here are admins or operators. */
const ASSIGNABLE = ['ADMIN', 'OPERATOR'] as const;
type Assignable = (typeof ASSIGNABLE)[number];
const ROLE_MSG = 'রোল হবে অ্যাডমিন বা অপারেটর।';

class CreateUserDto {
  @IsString()
  @MinLength(1, { message: 'নাম দিন।' })
  @MaxLength(100)
  name!: string;
  @IsEmail({}, { message: 'সঠিক ইমেইল দিন।' })
  email!: string;
  @IsString()
  @MinLength(8, { message: PASSWORD_MSG })
  password!: string;
  @IsIn(ASSIGNABLE, { message: ROLE_MSG })
  role!: Assignable;
}

class UpdateUserDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) operatorLimit?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsIn(ASSIGNABLE, { message: ROLE_MSG }) role?: Assignable;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional()
  @IsString()
  @MinLength(8, { message: PASSWORD_MSG })
  password?: string;
}

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  operatorLimit: true,
  createdById: true,
};

const OPERATORS_ONLY =
  'অ্যাডমিন শুধু নিজের খোলা অপারেটর অ্যাকাউন্ট সামলাতে পারেন।';

/**
 * The super admin manages every account. An admin opens and manages their own operators only,
 * up to their operator limit (one to start with); more needs the super admin's permission.
 */
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  private async quota(adminId: number) {
    const [me, used] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: adminId },
        select: { operatorLimit: true },
      }),
      this.prisma.user.count({
        where: { createdById: adminId, role: 'OPERATOR' },
      }),
    ]);
    return { limit: me?.operatorLimit ?? 0, used };
  }

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    if (me.role === 'SUPER_ADMIN') {
      const users = await this.prisma.user.findMany({
        select: {
          ...select,
          _count: { select: { createdUsers: { where: { role: 'OPERATOR' } } } },
        },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      });
      return {
        items: users.map(({ _count, ...u }) => ({
          ...u,
          operatorsUsed: _count.createdUsers,
        })),
        quota: null,
      };
    }
    const items = await this.prisma.user.findMany({
      where: { role: 'OPERATOR', createdById: me.id },
      select,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return { items, quota: await this.quota(me.id) };
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() me: AuthUser) {
    if (me.role !== 'SUPER_ADMIN') {
      if (dto.role !== 'OPERATOR') throw new ForbiddenException(OPERATORS_ONLY);
      const q = await this.quota(me.id);
      if (q.used >= q.limit)
        throw new ForbiddenException(
          `আপনি ${q.limit}টা অপারেটর অ্যাকাউন্ট খুলতে পারেন, সবগুলো খোলা হয়ে গেছে। আরও খুলতে সুপার অ্যাডমিনের অনুমতি চান।`,
        );
    }
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('এই ইমেইলে আগেই একজন ইউজার আছেন।');
    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        role: dto.role,
        createdById: me.id,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      select,
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() me: AuthUser,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('ইউজার পাওয়া যায়নি।');
    if (
      me.role !== 'SUPER_ADMIN' &&
      (target.role !== 'OPERATOR' ||
        target.createdById !== me.id ||
        (dto.role && dto.role !== 'OPERATOR') ||
        dto.operatorLimit !== undefined)
    )
      throw new ForbiddenException(OPERATORS_ONLY);
    if (target.role === 'SUPER_ADMIN' && (dto.active === false || dto.role))
      throw new BadRequestException(
        'সুপার অ্যাডমিনকে বন্ধ করা বা রোল বদলানো যাবে না। শুধু নাম আর পাসওয়ার্ড বদলানো যায়।',
      );
    if (id === me.id && dto.active === false)
      throw new BadRequestException('নিজেকে বন্ধ করা যাবে না।');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role: dto.role,
        operatorLimit: dto.operatorLimit,
        active: dto.active,
        passwordHash: dto.password
          ? await bcrypt.hash(dto.password, 10)
          : undefined,
      },
      select,
    });
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
