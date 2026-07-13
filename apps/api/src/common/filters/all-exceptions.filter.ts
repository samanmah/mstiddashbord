import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorDetail, type ApiErrorResponse, ErrorCode } from '@ppm/contracts';
import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = request.id ?? 'unknown';

    const body = this.buildBody(exception, requestId);

    if (body.statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} → ${body.statusCode}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} → ${body.statusCode}: ${body.code}`);
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, requestId: string): ApiErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return this.fromHttpException(status, res, requestId);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception, requestId);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'خطای داخلی سرور رخ داده است.',
      details: [],
      requestId,
    };
  }

  private fromHttpException(
    status: number,
    res: string | object,
    requestId: string,
  ): ApiErrorResponse {
    let code: string = this.defaultCodeForStatus(status);
    let message = 'خطایی رخ داده است.';
    let details: ApiErrorDetail[] = [];

    if (typeof res === 'string') {
      message = res;
    } else {
      const obj = res as Record<string, unknown>;
      if (typeof obj.code === 'string') code = obj.code;
      if (typeof obj.message === 'string') {
        message = obj.message;
      } else if (Array.isArray(obj.message)) {
        // خطاهای class-validator
        code = ErrorCode.VALIDATION_ERROR;
        message = 'اطلاعات واردشده معتبر نیست.';
        details = (obj.message as string[]).map((m) => ({ message: m }));
      }
      if (Array.isArray(obj.details)) {
        details = obj.details as ApiErrorDetail[];
      }
    }

    return { statusCode: status, code, message, details, requestId };
  }

  private fromPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    requestId: string,
  ): ApiErrorResponse {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: 'مقدار تکراری است؛ رکوردی با این مشخصات از قبل وجود دارد.',
          details: [],
          requestId,
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
          message: 'رکورد موردنظر یافت نشد.',
          details: [],
          requestId,
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ErrorCode.VALIDATION_ERROR,
          message: 'عملیات روی پایگاه داده ناموفق بود.',
          details: [],
          requestId,
        };
    }
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
