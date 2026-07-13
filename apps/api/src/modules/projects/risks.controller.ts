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
import { type RiskDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { CreateRiskDto, UpdateRiskDto } from './dto/risk.dto';
import { RisksService } from './risks.service';

@ApiTags('risks')
@Controller('projects/:projectId/risks')
export class RisksController {
  constructor(private readonly service: RisksService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست ریسک‌ها' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<RiskDto[]> {
    return this.service.findAll(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'افزودن ریسک' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateRiskDto,
    @Req() req: Request,
  ): Promise<RiskDto> {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Patch(':riskId')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش ریسک' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: UpdateRiskDto,
    @Req() req: Request,
  ): Promise<RiskDto> {
    return this.service.update(projectId, riskId, dto, getRequestContext(req));
  }

  @Delete(':riskId')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف نرم ریسک' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.remove(projectId, riskId, getRequestContext(req));
  }
}
