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
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type IndicatorDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { CreateIndicatorDto, UpdateIndicatorDto } from './dto/indicator.dto';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicators')
@Controller('projects/:projectId/indicators')
export class IndicatorsController {
  constructor(private readonly service: IndicatorsService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست شاخص‌ها' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<IndicatorDto[]> {
    return this.service.findAll(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'افزودن شاخص' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateIndicatorDto,
    @Req() req: Request,
  ): Promise<IndicatorDto> {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Patch(':indicatorId')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش شاخص' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('indicatorId', ParseUUIDPipe) indicatorId: string,
    @Body() dto: UpdateIndicatorDto,
    @Req() req: Request,
  ): Promise<IndicatorDto> {
    return this.service.update(projectId, indicatorId, dto, getRequestContext(req));
  }

  @Delete(':indicatorId')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف شاخص' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('indicatorId', ParseUUIDPipe) indicatorId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.remove(projectId, indicatorId, getRequestContext(req));
  }
}
