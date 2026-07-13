import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorCode, type ImportPreviewResult, UserRole, VALIDATION } from '@ppm/contracts';
import { type Request } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { getRequestContext } from '../../common/utils/request-context';
import { CommitImportDto } from './dto/commit-import.dto';
import { ImportService } from './import.service';

// مقایسه به‌صورت حروف‌کوچک انجام می‌شود؛ برخی کلاینت‌ها MIME را با حروف کوچک ارسال می‌کنند
// (مثلاً macroenabled به‌جای macroEnabled).
const ALLOWED_MIME = new Set(
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel.sheet.macroEnabled.12', // xlsm
    'application/vnd.ms-excel',
    'application/octet-stream',
    'application/zip',
  ].map((m) => m.toLowerCase()),
);

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK.." zip header

@ApiTags('imports')
@Controller('imports')
@Roles(UserRole.PROJECT_EDITOR)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('excel/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: VALIDATION.UPLOAD_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'پیش‌نمایش و اعتبارسنجی فایل Excel' })
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<ImportPreviewResult> {
    if (!file) {
      throw new BadRequestException({ code: ErrorCode.FILE_INVALID, message: 'فایلی ارسال نشده است.' });
    }
    const name = file.originalname.toLowerCase();
    const validExt = name.endsWith('.xlsx') || name.endsWith('.xlsm');
    const validMime = ALLOWED_MIME.has(file.mimetype.toLowerCase());
    const validMagic =
      file.buffer.length >= 4 && file.buffer.subarray(0, 4).equals(XLSX_MAGIC);
    if (!validExt || !validMime || !validMagic) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'فقط فایل‌های معتبر XLSX یا XLSM پذیرفته می‌شوند.',
      });
    }
    return this.importService.preview(file, getRequestContext(req));
  }

  @Post('excel/commit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ثبت نهایی و Import اتمیک فایل Excel' })
  commit(
    @Body() dto: CommitImportDto,
    @Req() req: Request,
  ): Promise<{ projectId: string }> {
    return this.importService.commit(dto.storedFilename, dto.fileHash, getRequestContext(req));
  }

  @Get()
  @ApiOperation({ summary: 'فهرست گزارش‌های Import' })
  list() {
    return this.importService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات گزارش Import' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.findOne(id);
  }
}
