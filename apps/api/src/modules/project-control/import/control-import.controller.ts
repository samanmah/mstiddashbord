import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ControlImportSourceType,
  ErrorCode,
  type MppEnvironmentStatus,
  UserRole,
  VALIDATION,
} from '@ppm/contracts';
import { type Request } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../../common/decorators/roles.decorator';
import { getRequestContext } from '../../../common/utils/request-context';
import { ControlImportService } from './control-import.service';
import {
  CommitImportDto,
  MapImportDto,
  PreviewImportDto,
  UploadImportMetaDto,
} from './dto/control-import.dto';
import { MPP_ADAPTER, MppAdapter } from './mpp/mpp-adapter.interface';

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]); // MPP (OLE2)

@ApiTags('project-control/imports')
@Controller('projects/:projectId/control/imports')
export class ControlImportController {
  constructor(
    private readonly service: ControlImportService,
    @Inject(MPP_ADAPTER) private readonly mppAdapter: MppAdapter,
  ) {}

  @Get('mpp-check')
  @ApiOperation({ summary: 'بررسی محیط اجرای MPP (Java/MPXJ)' })
  mppCheck(): Promise<MppEnvironmentStatus> {
    return this.mppAdapter.checkEnvironment();
  }

  @Post('upload')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.CREATED)
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
  @ApiOperation({ summary: 'بارگذاری فایل Excel/MPP و ساخت ImportBatch' })
  async upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() meta: UploadImportMetaDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException({ code: ErrorCode.FILE_INVALID, message: 'فایلی ارسال نشده است.' });
    }
    const name = file.originalname.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xlsm');
    const isMpp = name.endsWith('.mpp');
    if (!isExcel && !isMpp) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'فقط فایل‌های xlsx/xlsm/mpp پذیرفته می‌شوند.',
      });
    }
    const magicOk =
      file.buffer.length >= 4 &&
      (file.buffer.subarray(0, 4).equals(XLSX_MAGIC) ||
        file.buffer.subarray(0, 4).equals(OLE_MAGIC));
    if (!magicOk) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'محتوای فایل با پسوند آن هم‌خوانی ندارد.',
      });
    }
    const sourceType =
      meta.sourceType ?? (isMpp ? ControlImportSourceType.MPP : ControlImportSourceType.EXCEL);
    return this.service.upload(projectId, file, sourceType, getRequestContext(req));
  }

  @Post(':id/preview')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'پیش‌نمایش/Dry-Run و Manifest' })
  preview(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewImportDto,
    @Req() req: Request,
  ) {
    return this.service.preview(projectId, id, dto.dryRun ?? true, getRequestContext(req));
  }

  @Post(':id/map')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'اعمال Mapping و حل Conflict' })
  map(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MapImportDto,
    @Req() req: Request,
  ) {
    return this.service.map(projectId, id, dto.mappings, getRequestContext(req));
  }

  @Post(':id/validate')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'اعتبارسنجی کامل بدون ذخیره' })
  validate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.validate(projectId, id, getRequestContext(req));
  }

  @Post(':id/commit')
  @Roles(UserRole.PROJECT_EDITOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Commit اتمیک' })
  commit(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommitImportDto,
    @Req() req: Request,
  ) {
    if (!dto.confirm) {
      throw new BadRequestException({
        code: ErrorCode.IMPORT_ERROR,
        message: 'برای Commit باید confirm=true ارسال شود.',
      });
    }
    return this.service.commit(
      projectId,
      id,
      dto.allowWarnings ?? false,
      getRequestContext(req),
      dto.mode,
    );
  }

  @Get()
  @ApiOperation({ summary: 'فهرست دسته‌های Import' })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.list(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات یک دستهٔ Import' })
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(projectId, id);
  }

  @Get(':id/errors')
  @ApiOperation({ summary: 'خطاها/هشدارهای یک دستهٔ Import' })
  errors(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.errors(projectId, id);
  }
}
