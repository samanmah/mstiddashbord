import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { BaselinesService } from './baselines.service';
import { CreateBaselineDto } from './dto/project-control.dto';

@ApiTags('project-control/baselines')
@Controller('projects/:projectId/control/baselines')
export class BaselinesController {
  constructor(private readonly service: BaselinesService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست Baselineها' })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.list(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ایجاد Baseline' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateBaselineDto,
    @Req() req: Request,
  ) {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Post(':id/activate')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'فعال‌سازی Baseline' })
  activate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.activate(projectId, id, getRequestContext(req));
  }

  @Get(':id/compare')
  @ApiOperation({ summary: 'مقایسهٔ Baseline با وضعیت فعلی' })
  compare(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.compare(projectId, id);
  }
}
