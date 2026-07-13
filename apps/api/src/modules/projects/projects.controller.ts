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
import { type DashboardDto, type ProjectDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { DashboardService } from '../dashboard/dashboard.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'فهرست پروژه‌ها' })
  findAll(): Promise<ProjectDto[]> {
    return this.projectsService.findAll();
  }

  @Post()
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ایجاد پروژه' })
  create(@Body() dto: CreateProjectDto, @Req() req: Request): Promise<ProjectDto> {
    return this.projectsService.create(dto, getRequestContext(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات پروژه' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return this.projectsService.findOne(id);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'داده کامل داشبورد پروژه در یک DTO' })
  dashboard(@Param('id', ParseUUIDPipe) id: string): Promise<DashboardDto> {
    return this.dashboardService.getDashboard(id);
  }

  @Patch(':id')
  @Roles(UserRole.PROJECT_EDITOR)
  @ApiOperation({ summary: 'ویرایش پروژه با کنترل هم‌زمانی' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ): Promise<ProjectDto> {
    return this.projectsService.update(id, dto, getRequestContext(req));
  }

  @Delete(':id')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف پروژه' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<void> {
    await this.projectsService.remove(id, getRequestContext(req));
  }
}
