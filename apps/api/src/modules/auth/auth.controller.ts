import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser } from '@ppm/contracts';
import { type Request, type Response } from 'express';
import { type AppConfig } from '../../config/configuration';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { AuthService } from './auth.service';
import { clearAuthCookies, REFRESH_COOKIE_NAME, setAuthCookies } from './cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private get config(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ورود کاربر و صدور کوکی‌های امن' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser }> {
    const ctx = getRequestContext(req);
    const result = await this.authService.login(
      dto.username,
      dto.password,
      dto.rememberMe ?? false,
      ctx,
    );
    setAuthCookies(res, this.config, result.tokens, result.rememberMe);
    return { user: result.user };
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تمدید نشست با چرخش Refresh Token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[REFRESH_COOKIE_NAME];
    const ctx = getRequestContext(req);
    const result = await this.authService.refresh(raw, ctx);
    // چرخش refresh: طول عمر را حفظ می‌کنیم (rememberMe از طریق طول عمر کوکی جاری مدیریت می‌شود).
    setAuthCookies(res, this.config, result.tokens, true);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'خروج و ابطال Refresh Token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(raw, getRequestContext(req));
    clearAuthCookies(res, this.config);
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'اطلاعات کاربر جاری' })
  async me(@CurrentUser() user: RequestUser): Promise<{ user: AuthUser }> {
    return { user: await this.authService.me(user.id) };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تغییر رمز عبور کاربر جاری' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      getRequestContext(req),
    );
    clearAuthCookies(res, this.config);
    return { success: true };
  }
}
