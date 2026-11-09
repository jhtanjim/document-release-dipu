import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';

const PASSWORD_MSG = 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।';

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
  @IsEnum(Role)
  role!: Role;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional()
  @IsString()
  @MinLength(8, { message: PASSWORD_MSG })
  password?: string;
}

const select = { id: true, name: true, email: true, role: true, active: true };

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.user.findMany({
      select,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('এই ইমেইলে আগেই একজন ইউজার আছেন।');
    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        role: dto.role,
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
    if (!(await this.prisma.user.findUnique({ where: { id } })))
      throw new NotFoundException('ইউজার পাওয়া যায়নি।');
    if (
      id === me.id &&
      (dto.active === false || (dto.role && dto.role !== 'ADMIN'))
    )
      throw new BadRequestException('নিজেকে বন্ধ বা অপারেটর করা যাবে না।');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role: dto.role,
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
