import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BaselinesController } from './baselines.controller';
import { BaselinesService } from './baselines.service';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { ProjectControlController } from './project-control.controller';
import { ProjectControlAnalyticsService } from './project-control-analytics.service';
import { ProjectControlCalculationService } from './project-control-calculation.service';
import { ProjectControlService } from './project-control.service';
import { WbsController } from './wbs.controller';
import { WbsService } from './wbs.service';

@Module({
  imports: [AuditModule],
  controllers: [
    ProjectControlController,
    WbsController,
    DependenciesController,
    ProgressController,
    BaselinesController,
  ],
  providers: [
    ProjectControlService,
    ProjectControlCalculationService,
    ProjectControlAnalyticsService,
    WbsService,
    DependenciesService,
    ProgressService,
    BaselinesService,
  ],
  exports: [ProjectControlService, ProjectControlCalculationService],
})
export class ProjectControlModule {}
