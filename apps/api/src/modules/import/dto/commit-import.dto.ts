import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CommitImportDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9-]+\.xlsx$/i, { message: 'نام فایل نامعتبر است.' })
  storedFilename!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-f0-9]{64}$/i, { message: 'اثر انگشت فایل نامعتبر است.' })
  fileHash!: string;
}
