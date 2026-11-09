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
import { Prisma } from '@prisma/client';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';

class CreateNameDto {
  @IsString()
  @MinLength(1, { message: 'নাম দিন।' })
  @MaxLength(120)
  name!: string;
}

class UpdateNameDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'নাম দিন।' })
  @MaxLength(120)
  name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

type Kind = 'importer' | 'shippingAgent';
const LABEL: Record<Kind, string> = {
  importer: 'ইম্পোর্টার',
  shippingAgent: 'শিপিং এজেন্ট',
};
const BANGLA = /[ঀ-৿]/;

/** Importers and shipping agents are the same shape: a unique name that can be hidden from new jobs. */
abstract class NamesController {
  constructor(
    protected prisma: PrismaService,
    private kind: Kind,
  ) {}

  // Both delegates share these method signatures; the cast keeps one implementation for both lists.
  private get model() {
    return this.prisma[this.kind] as unknown as Prisma.ImporterDelegate;
  }

  private clean(name: string) {
    const n = name.trim().replace(/\s+/g, ' ');
    if (this.kind === 'importer' && BANGLA.test(n))
      throw new BadRequestException('ইম্পোর্টারের নাম ইংরেজিতে লিখুন।');
    return n;
  }

  private async unique<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(`এই নামে ${LABEL[this.kind]} আগেই আছে।`);
      throw e;
    }
  }

  @Get()
  async list() {
    const rows = await this.model.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { jobs: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      jobCount: r._count.jobs,
    }));
  }

  @Post()
  async create(@Body() dto: CreateNameDto) {
    const r = await this.unique(() =>
      this.model.create({ data: { name: this.clean(dto.name) } }),
    );
    return { id: r.id, name: r.name, active: r.active, jobCount: 0 };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNameDto,
    @CurrentUser() me: AuthUser,
  ) {
    if (dto.active !== undefined && me.role !== 'ADMIN')
      throw new ForbiddenException(
        'লুকানো বা চালু করা শুধু অ্যাডমিন করতে পারেন।',
      );
    if (!(await this.model.findUnique({ where: { id } })))
      throw new NotFoundException(`${LABEL[this.kind]} পাওয়া যায়নি।`);
    const r = await this.unique(() =>
      this.model.update({
        where: { id },
        data: {
          name: dto.name ? this.clean(dto.name) : undefined,
          active: dto.active,
        },
      }),
    );
    return { id: r.id, name: r.name, active: r.active };
  }
}

@Controller('importers')
export class ImportersController extends NamesController {
  constructor(prisma: PrismaService) {
    super(prisma, 'importer');
  }
}

@Controller('agents')
export class AgentsController extends NamesController {
  constructor(prisma: PrismaService) {
    super(prisma, 'shippingAgent');
  }
}

@Module({ controllers: [ImportersController, AgentsController] })
export class CatalogModule {}
