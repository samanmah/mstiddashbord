import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ControlImportSourceType } from '@ppm/contracts';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewImportDto {
  @ApiPropertyOptional({ description: 'اجرای آزمایشی بدون ذخیره (پیش‌فرض true).', default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class MapImportItemDto {
  @ApiProperty({ description: 'شمارهٔ سطر منبع.' })
  @Type(() => Number)
  sourceRow!: number;

  @ApiPropertyOptional({ description: 'شناسهٔ نود WBS برای تطبیق دستی.' })
  @IsOptional()
  @IsUUID()
  matchedNodeId?: string;

  @ApiPropertyOptional({ description: 'نادیده‌گرفتن این سطر.' })
  @IsOptional()
  @IsBoolean()
  ignore?: boolean;
}

export class MapImportDto {
  @ApiProperty({ type: [MapImportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MapImportItemDto)
  mappings!: MapImportItemDto[];
}

export class CommitImportDto {
  @ApiPropertyOptional({ description: 'تأیید نهایی؛ بدون آن Commit انجام نمی‌شود.' })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  @ApiPropertyOptional({ description: 'اجازهٔ Commit با وجود هشدارها.' })
  @IsOptional()
  @IsBoolean()
  allowWarnings?: boolean;
}

export class UploadImportMetaDto {
  @ApiPropertyOptional({
    enum: Object.values(ControlImportSourceType),
    description: 'نوع منبع (EXCEL/MPP). در صورت خالی از پسوند فایل تشخیص داده می‌شود.',
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(ControlImportSourceType))
  sourceType?: ControlImportSourceType;

  @ApiPropertyOptional({ description: 'عنوان Control Plan در صورت نبود Plan فعال.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  planTitle?: string;
}
