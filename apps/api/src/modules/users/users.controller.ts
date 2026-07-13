import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type PaginatedResult, type UserDto, UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto, UpdateStatusDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.PROJECT_EDITOR)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست کاربران (صفحه‌بندی، جستجو و فیلتر)' })
  findAll(@Query() query: QueryUsersDto): Promise<PaginatedResult<UserDto>> {
    return this.usersService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'ایجاد کاربر' })
  create(@Body() dto: CreateUserDto, @Req() req: Request): Promise<UserDto> {
    return this.usersService.create(dto, getRequestContext(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات کاربر' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش کاربر' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ): Promise<UserDto> {
    return this.usersService.update(id, dto, getRequestContext(req));
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'بازنشانی رمز عبور کاربر' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.usersService.resetPassword(id, dto.newPassword, getRequestContext(req));
    return { success: true };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'فعال/غیرفعال‌سازی کاربر' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: Request,
  ): Promise<UserDto> {
    return this.usersService.setStatus(id, dto.isActive, getRequestContext(req));
  }
}
