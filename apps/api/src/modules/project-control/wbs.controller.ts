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
import { UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import {
  BulkWbsDto,
  CreateWbsNodeDto,
  ReorderDto,
  ReparentDto,
  UpdateWbsNodeDto,
} from './dto/project-control.dto';
import { WbsService } from './wbs.service';

@ApiTags('project-control/wbs')
@Controller('projects/:projectId/control/wbs')
export class WbsController {
  constructor(private readonly service: WbsService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست تخت WBS با مقادیر محاسبه‌شده' })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.list(projectId);
  }

  @Post('nodes')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ایجاد نود WBS' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateWbsNodeDto,
    @Req() req: Request,
  ) {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Put('bulk')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ذخیرهٔ گروهی نودها' })
  bulk(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkWbsDto,
    @Req() req: Request,
  ) {
    return this.service.bulkUpsert(projectId, dto, getRequestContext(req));
  }

  @Post('reorder')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'تغییر ترتیب نودها' })
  async reorder(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ) {
    await this.service.reorder(projectId, dto, getRequestContext(req));
  }

  @Post('reparent')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'تغییر والد نود (با بررسی چرخه)' })
  reparent(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ReparentDto,
    @Req() req: Request,
  ) {
    return this.service.reparent(projectId, dto, getRequestContext(req));
  }

  @Post('validate')
  @ApiOperation({ summary: 'اعتبارسنجی ساختار WBS' })
  validate(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.validate(projectId);
  }

  @Get('nodes/:nodeId')
  @ApiOperation({ summary: 'دریافت یک نود' })
  getOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    return this.service.getOne(projectId, nodeId);
  }

  @Patch('nodes/:nodeId')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش نود' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Body() dto: UpdateWbsNodeDto,
    @Req() req: Request,
  ) {
    return this.service.update(projectId, nodeId, dto, getRequestContext(req));
  }

  @Delete('nodes/:nodeId')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف نرم نود و نوادگان' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Req() req: Request,
  ) {
    await this.service.remove(projectId, nodeId, getRequestContext(req));
  }

  @Get('nodes/:nodeId/children')
  @ApiOperation({ summary: 'فرزندان نود' })
  children(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    return this.service.children(projectId, nodeId);
  }

  @Get('nodes/:nodeId/ancestors')
  @ApiOperation({ summary: 'نیاکان نود' })
  ancestors(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    return this.service.ancestors(projectId, nodeId);
  }
}
