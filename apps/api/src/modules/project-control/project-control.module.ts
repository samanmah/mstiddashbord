import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BaselinesController } from './baselines.controller';
import { BaselinesService } from './baselines.service';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { ControlImportController } from './import/control-import.controller';
import { ControlImportService } from './import/control-import.service';
import { GanttExcelParserService } from './import/gantt-excel-parser.service';
import { MPP_ADAPTER } from './import/mpp/mpp-adapter.interface';
import { MpxjMppAdapter } from './import/mpp/mpxj-mpp.adapter';
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
    ControlImportController,
  ],
  providers: [
    ProjectControlService,
    ProjectControlCalculationService,
    ProjectControlAnalyticsService,
    WbsService,
    DependenciesService,
    ProgressService,
    BaselinesService,
    ControlImportService,
    GanttExcelParserService,
    MpxjMppAdapter,
    { provide: MPP_ADAPTER, useExisting: MpxjMppAdapter },
  ],
  exports: [ProjectControlService, ProjectControlCalculationService, ControlImportService],
})
export class ProjectControlModule {}
