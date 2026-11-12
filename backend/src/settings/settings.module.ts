import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Patch,
} from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';

class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) defaultRate?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) surveyDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) billDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) releaseDays?: number;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    // A plain read on every request; the row is only created the first time.
    const s =
      (await this.prisma.setting.findUnique({ where: { id: 1 } })) ??
      (await this.prisma.setting.create({ data: { id: 1 } }));
    return {
      defaultRate: s.defaultRate,
      surveyDays: s.surveyDays,
      billDays: s.billDays,
      releaseDays: s.releaseDays,
    };
  }
}

@Controller('settings')
export class SettingsController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Roles('ADMIN')
  @Patch()
  async update(@Body() dto: UpdateSettingsDto) {
    await this.settings.get();
    await this.prisma.setting.update({ where: { id: 1 }, data: dto });
    return this.settings.get();
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
