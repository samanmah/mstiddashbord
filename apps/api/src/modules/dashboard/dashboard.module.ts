import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Module({
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
