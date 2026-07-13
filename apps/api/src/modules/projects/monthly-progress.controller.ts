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
import { type MonthlyProgressDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import {
  BulkMonthlyProgressDto,
  CreateMonthlyProgressDto,
  UpdateMonthlyProgressDto,
} from './dto/monthly-progress.dto';
import { MonthlyProgressService } from './monthly-progress.service';

@ApiTags('monthly-progress')
@Controller('projects/:projectId/monthly-progress')
export class MonthlyProgressController {
  constructor(private readonly service: MonthlyProgressService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست پیشرفت ماهانه' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<MonthlyProgressDto[]> {
    return this.service.findAll(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'افزودن دوره ماهانه' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateMonthlyProgressDto,
    @Req() req: Request,
  ): Promise<MonthlyProgressDto> {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Put('bulk')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ذخیره گروهی دوره‌های ماهانه' })
  bulk(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkMonthlyProgressDto,
    @Req() req: Request,
  ): Promise<MonthlyProgressDto[]> {
    return this.service.bulkReplace(projectId, dto.items, getRequestContext(req));
  }

  @Patch(':itemId')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش دوره ماهانه' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateMonthlyProgressDto,
    @Req() req: Request,
  ): Promise<MonthlyProgressDto> {
    return this.service.update(projectId, itemId, dto, getRequestContext(req));
  }

  @Delete(':itemId')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف دوره ماهانه' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.remove(projectId, itemId, getRequestContext(req));
  }
}
