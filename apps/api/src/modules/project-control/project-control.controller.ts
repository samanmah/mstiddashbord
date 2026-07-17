import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { EnableControlDto } from './dto/project-control.dto';
import { ProjectControlAnalyticsService } from './project-control-analytics.service';
import { ProjectControlService } from './project-control.service';

@ApiTags('project-control')
@Controller('projects/:projectId/control')
export class ProjectControlController {
  constructor(
    private readonly control: ProjectControlService,
    private readonly analytics: ProjectControlAnalyticsService,
  ) {}

  @Post('enable')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'فعال‌سازی کنترل پروژهٔ پیشرفته' })
  enable(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: EnableControlDto,
    @Req() req: Request,
  ) {
    return this.control.enableControl(projectId, dto, getRequestContext(req));
  }

  @Get('plan')
  @ApiOperation({ summary: 'برنامهٔ کنترل فعال (یا null)' })
  plan(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.control.getActivePlanOrNull(projectId);
  }

  @Post('plans/:planId/activate')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'فعال‌سازی مجدد یک Control Plan (Rollback نسخه‌ای)' })
  activatePlan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Req() req: Request,
  ) {
    return this.control.activatePlan(projectId, planId, getRequestContext(req));
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'داشبورد مدیریتی یکپارچه (Aggregated)' })
  dashboard(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.analytics.dashboard(projectId);
  }

  @Get('gantt')
  @ApiOperation({ summary: 'داده‌های Gantt' })
  gantt(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.analytics.gantt(projectId);
  }

  @Get('analytics/phase-rollup')
  @ApiOperation({ summary: 'تجمیع هفت فاز' })
  phaseRollup(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.analytics.phaseRollupEndpoint(projectId);
  }

  @Get('analytics/s-curve')
  @ApiOperation({ summary: 'منحنی S' })
  sCurve(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.analytics.sCurve(projectId);
  }

  @Get('analytics/critical-path')
  @ApiOperation({ summary: 'مسیر بحرانی' })
  criticalPath(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.analytics.criticalPathEndpoint(projectId);
  }

  @Get('analytics/data-quality')
  @ApiOperation({ summary: 'کیفیت داده' })
  dataQuality(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.analytics.dataQualityEndpoint(projectId);
  }
}
