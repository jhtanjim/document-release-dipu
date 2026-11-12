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
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';

class CreateRequestDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class DecideDto {
  @IsBoolean() approve!: boolean;
}

/**
 * An admin may open a set number of operator accounts (one to start with). For more, they ask here;
 * the super admin approves (the admin's limit goes up by one) or rejects.
 */
@Roles('ADMIN')
@Controller('operator-requests')
export class OperatorRequestsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    const rows = await this.prisma.operatorRequest.findMany({
      where: me.role === 'SUPER_ADMIN' ? {} : { adminId: me.id },
      include: {
        admin: {
          select: { id: true, name: true, email: true, operatorLimit: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      admin: r.admin,
    }));
  }

  @Post()
  async create(@Body() dto: CreateRequestDto, @CurrentUser() me: AuthUser) {
    if (me.role !== 'ADMIN')
      throw new ForbiddenException('অনুমতি চাইতে পারেন শুধু অ্যাডমিন।');
    if (
      await this.prisma.operatorRequest.findFirst({
        where: { adminId: me.id, status: 'PENDING' },
      })
    )
      throw new ConflictException(
        'আপনার একটা অনুরোধ আগেই অপেক্ষায় আছে। সুপার অ্যাডমিনের উত্তরের অপেক্ষা করুন।',
      );
    const r = await this.prisma.operatorRequest.create({
      data: { adminId: me.id, note: dto.note?.trim() || null },
    });
    return { id: r.id, status: r.status };
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id')
  async decide(@Param('id', ParseIntPipe) id: number, @Body() dto: DecideDto) {
    const r = await this.prisma.operatorRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('অনুরোধ পাওয়া যায়নি।');
    if (r.status !== 'PENDING')
      throw new BadRequestException(
        'এই অনুরোধের সিদ্ধান্ত আগেই দেওয়া হয়েছে।',
      );
    await this.prisma.$transaction([
      this.prisma.operatorRequest.update({
        where: { id },
        data: {
          status: dto.approve ? 'APPROVED' : 'REJECTED',
          decidedAt: new Date(),
        },
      }),
      ...(dto.approve
        ? [
            this.prisma.user.update({
              where: { id: r.adminId },
              data: { operatorLimit: { increment: 1 } },
            }),
          ]
        : []),
    ]);
    return { ok: true };
  }
}

@Module({ controllers: [OperatorRequestsController] })
export class OperatorRequestsModule {}
