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
import { type DecisionDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto, UpdateDecisionDto } from './dto/decision.dto';

@ApiTags('decisions')
@Controller('projects/:projectId/decisions')
export class DecisionsController {
  constructor(private readonly service: DecisionsService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست تصمیمات' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<DecisionDto[]> {
    return this.service.findAll(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'افزودن تصمیم' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateDecisionDto,
    @Req() req: Request,
  ): Promise<DecisionDto> {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Patch(':decisionId')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش تصمیم' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
    @Body() dto: UpdateDecisionDto,
    @Req() req: Request,
  ): Promise<DecisionDto> {
    return this.service.update(projectId, decisionId, dto, getRequestContext(req));
  }

  @Delete(':decisionId')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف نرم تصمیم' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.remove(projectId, decisionId, getRequestContext(req));
  }
}
