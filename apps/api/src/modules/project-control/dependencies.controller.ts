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
import { UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { DependenciesService } from './dependencies.service';
import { CreateDependencyDto, UpdateDependencyDto } from './dto/project-control.dto';

@ApiTags('project-control/dependencies')
@Controller('projects/:projectId/control/dependencies')
export class DependenciesController {
  constructor(private readonly service: DependenciesService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست وابستگی‌ها' })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.list(projectId);
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ایجاد وابستگی' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateDependencyDto,
    @Req() req: Request,
  ) {
    return this.service.create(projectId, dto, getRequestContext(req));
  }

  @Post('validate')
  @ApiOperation({ summary: 'اعتبارسنجی گراف وابستگی' })
  validate(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.validate(projectId);
  }

  @Patch(':id')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش وابستگی' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDependencyDto,
    @Req() req: Request,
  ) {
    return this.service.update(projectId, id, dto, getRequestContext(req));
  }

  @Delete(':id')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف وابستگی' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.service.remove(projectId, id, getRequestContext(req));
  }
}
