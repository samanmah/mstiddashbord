import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type ActivityDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { ActivitiesService } from './activities.service';
import {
  BulkActivitiesDto,
  CreateActivityDto,
  UpdateActivityDto,
} from './dto/activity.dto';

@ApiTags('activities')
@Controller('projects/:projectId/activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست فعالیت‌ها' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<ActivityDto[]> {
    return this.service.findAll(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'افزودن فعالیت' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateActivityDto,
    @Req() req: Request,
  ): Promise<ActivityDto> {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Put('bulk')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ذخیره گروهی فعالیت‌ها (با اعتبارسنجی وزن ۱۰۰)' })
  bulk(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkActivitiesDto,
    @Req() req: Request,
  ): Promise<ActivityDto[]> {
    return this.service.bulkReplace(projectId, dto.items, getRequestContext(req));
  }

  @Patch(':activityId')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش فعالیت' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateActivityDto,
    @Req() req: Request,
  ): Promise<ActivityDto> {
    return this.service.update(projectId, activityId, dto, getRequestContext(req));
  }

  @Delete(':activityId')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف نرم فعالیت' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.remove(projectId, activityId, getRequestContext(req));
  }
}
