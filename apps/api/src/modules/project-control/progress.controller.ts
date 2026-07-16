import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { BulkProgressDto, CreateProgressDto } from './dto/project-control.dto';
import { ProgressService } from './progress.service';

@ApiTags('project-control/progress')
@Controller('projects/:projectId/control')
export class ProgressController {
  constructor(private readonly service: ProgressService) {}

  @Get('progress')
  @ApiOperation({ summary: 'فهرست گزارش‌های پیشرفت' })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.list(projectId);
  }

  @Post('progress')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ثبت پیشرفت' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProgressDto,
    @Req() req: Request,
  ) {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Put('progress/bulk')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ثبت گروهی پیشرفت' })
  bulk(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkProgressDto,
    @Req() req: Request,
  ) {
    return this.service.bulk(projectId, dto.items, getRequestContext(req));
  }

  @Get('nodes/:nodeId/progress-history')
  @ApiOperation({ summary: 'تاریخچهٔ پیشرفت یک نود' })
  history(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    return this.service.history(projectId, nodeId);
  }
}
