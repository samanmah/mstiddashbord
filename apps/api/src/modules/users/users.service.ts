import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  normalizeUsername,
  type PaginatedResult,
  type UserDto,
  UserRole,
} from '@ppm/contracts';
import { type Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../common/services/password.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { type CreateUserDto } from './dto/create-user.dto';
import { type QueryUsersDto } from './dto/query-users.dto';
import { type UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  private toDto(user: User): UserDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as UserRole,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive === 'true' || query.isActive === 'false') {
      where.isActive = query.isActive === 'true';
    }
    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { username: { contains: term, mode: 'insensitive' } },
        { fullName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: users.map((u) => this.toDto(u)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'کاربر یافت نشد.' });
    return this.toDto(user);
  }

  async create(dto: CreateUserDto, ctx: AuditContext): Promise<UserDto> {
    const normalized = normalizeUsername(dto.username);
    const existing = await this.prisma.user.findUnique({
      where: { normalizedUsername: normalized },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'کاربری با این نام کاربری از قبل وجود دارد.',
      });
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        normalizedUsername: normalized,
        fullName: dto.fullName.trim(),
        role: dto.role,
        passwordHash,
      },
    });
    await this.audit.record({
      ...ctx,
      entityType: 'User',
      entityId: user.id,
      action: AuditAction.CREATE,
      newValue: { username: user.username, fullName: user.fullName, role: user.role },
    });
    return this.toDto(user);
  }

  async update(id: string, dto: UpdateUserDto, ctx: AuditContext): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'کاربر یافت نشد.' });

    // جلوگیری از حذف نقش آخرین ویرایشگر فعال.
    if (
      dto.role &&
      dto.role !== UserRole.PROJECT_EDITOR &&
      user.role === UserRole.PROJECT_EDITOR
    ) {
      await this.ensureNotLastEditor(id);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        role: dto.role,
      },
    });
    await this.audit.record({
      ...ctx,
      entityType: 'User',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: { fullName: user.fullName, role: user.role },
      newValue: { fullName: updated.fullName, role: updated.role },
    });
    return this.toDto(updated);
  }

  async setStatus(id: string, isActive: boolean, ctx: AuditContext): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'کاربر یافت نشد.' });

    if (!isActive && user.role === UserRole.PROJECT_EDITOR) {
      await this.ensureNotLastEditor(id);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      ...ctx,
      entityType: 'User',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: { isActive: user.isActive },
      newValue: { isActive },
    });
    return this.toDto(updated);
  }

  async resetPassword(id: string, newPassword: string, ctx: AuditContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'کاربر یافت نشد.' });
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      ...ctx,
      entityType: 'User',
      entityId: id,
      action: AuditAction.PASSWORD_RESET,
    });
  }

  private async ensureNotLastEditor(excludeUserId: string): Promise<void> {
    const activeEditors = await this.prisma.user.count({
      where: {
        role: UserRole.PROJECT_EDITOR,
        isActive: true,
        id: { not: excludeUserId },
      },
    });
    if (activeEditors === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'نمی‌توان آخرین ویرایشگر فعال سامانه را غیرفعال یا تغییر نقش داد.',
      });
    }
  }
}
