import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';
import { MonthlyProgressController } from './monthly-progress.controller';
import { MonthlyProgressService } from './monthly-progress.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

@Module({
  imports: [AuditModule, DashboardModule],
  controllers: [
    ProjectsController,
    IndicatorsController,
    MonthlyProgressController,
    ActivitiesController,
    RisksController,
    DecisionsController,
  ],
  providers: [
    ProjectsService,
    IndicatorsService,
    MonthlyProgressService,
    ActivitiesService,
    RisksService,
    DecisionsService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
