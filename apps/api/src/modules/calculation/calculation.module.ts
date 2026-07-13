import { Global, Module } from '@nestjs/common';
import { DashboardCalculationService } from './dashboard-calculation.service';

@Global()
@Module({
  providers: [DashboardCalculationService],
  exports: [DashboardCalculationService],
})
export class CalculationModule {}
