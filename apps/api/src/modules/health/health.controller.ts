import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (error) {
      return {
        database: {
          status: 'down',
          message: error instanceof Error ? error.message : 'اتصال دیتابیس ناموفق است.',
        },
      };
    }
  }

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'بررسی سلامت کلی (شامل دیتابیس)' })
  check() {
    return this.health.check([() => this.checkDatabase()]);
  }

  @Public()
  @Get('liveness')
  @ApiOperation({ summary: 'زنده بودن سرویس' })
  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'آماده بودن سرویس (اتصال دیتابیس)' })
  readiness() {
    return this.health.check([() => this.checkDatabase()]);
  }
}
