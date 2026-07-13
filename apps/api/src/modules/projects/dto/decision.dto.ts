import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DecisionStatus, VALIDATION } from '@ppm/contracts';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsOptionalJalaliDate } from '../../../common/validators/is-jalali-date.validator';

export class CreateDecisionDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  subject?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  owner?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1405/06/01' })
  @IsOptionalJalaliDate()
  dueDate?: string | null;

  @ApiProperty({ enum: DecisionStatus })
  @IsEnum(DecisionStatus, { message: 'وضعیت نامعتبر است.' })
  status!: DecisionStatus;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateDecisionDto extends PartialType(CreateDecisionDto) {}
