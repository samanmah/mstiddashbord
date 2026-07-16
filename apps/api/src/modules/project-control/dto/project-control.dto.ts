import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  AssignmentRole,
  ControlNodeStatus,
  ControlPeriodUnit,
  DependencySource,
  DependencyType,
  VALIDATION,
  WbsNodeType,
  WeightSource,
} from '@ppm/contracts';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsJalaliDate } from '../../../common/validators/is-jalali-date.validator';

export class EnableControlDto {
  @ApiProperty({ example: 'برنامهٔ کنترل پروژه' })
  @IsString()
  @MinLength(1)
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiProperty({ example: '1405/04/25' })
  @IsJalaliDate()
  statusDate!: string;

  @ApiPropertyOptional({ enum: ControlPeriodUnit, default: ControlPeriodUnit.MONTH })
  @IsOptional()
  @IsEnum(ControlPeriodUnit)
  periodUnit?: ControlPeriodUnit;

  @ApiPropertyOptional({ default: 'IRR' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  currency?: string;
}

export class CreateWbsNodeDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'عنوان الزامی است.' })
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ enum: WbsNodeType, default: WbsNodeType.TASK })
  @IsOptional()
  @IsEnum(WbsNodeType)
  nodeType?: WbsNodeType;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1405/04/01' })
  @IsOptional()
  @IsJalaliDate()
  plannedStart?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1405/06/31' })
  @IsOptional()
  @IsJalaliDate()
  plannedFinish?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsJalaliDate()
  actualStart?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsJalaliDate()
  actualFinish?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsJalaliDate()
  deadline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedDurationMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentComplete?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  physicalProgress?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  plannedProgressOverride?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number | null;

  @ApiPropertyOptional({ enum: WeightSource })
  @IsOptional()
  @IsEnum(WeightSource)
  weightSource?: WeightSource;

  @ApiPropertyOptional({ nullable: true, description: 'مبلغ به کوچک‌ترین واحد پول (رشته عددی)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  budgetAmount?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ownerText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  definitionOfDone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
  notes?: string | null;

  @ApiPropertyOptional({ enum: ControlNodeStatus, nullable: true })
  @IsOptional()
  @IsEnum(ControlNodeStatus)
  statusOverride?: ControlNodeStatus | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateWbsNodeDto extends PartialType(CreateWbsNodeDto) {
  @ApiPropertyOptional({ description: 'نسخه برای Optimistic Concurrency' })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  nodeId!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class ReparentDto {
  @ApiProperty()
  @IsUUID()
  nodeId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  newParentId?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class BulkWbsItemDto extends CreateWbsNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class BulkWbsDto {
  @ApiProperty({ type: [BulkWbsItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkWbsItemDto)
  items!: BulkWbsItemDto[];
}

export class CreateDependencyDto {
  @ApiProperty()
  @IsUUID()
  predecessorNodeId!: string;

  @ApiProperty()
  @IsUUID()
  successorNodeId!: string;

  @ApiPropertyOptional({ enum: DependencyType, default: DependencyType.FS })
  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  lagMinutes?: number;

  @ApiPropertyOptional({ enum: DependencySource, default: DependencySource.MANUAL })
  @IsOptional()
  @IsEnum(DependencySource)
  source?: DependencySource;
}

export class UpdateDependencyDto extends PartialType(CreateDependencyDto) {}

export class CreateProgressDto {
  @ApiProperty()
  @IsUUID()
  nodeId!: string;

  @ApiProperty({ example: '1405/04/25' })
  @IsJalaliDate()
  reportingDate!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  actualPercent!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  physicalProgress?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  financialProgress?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  actualCost?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  remainingDurationMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsJalaliDate()
  forecastFinish?: string | null;

  @ApiPropertyOptional({ enum: ControlNodeStatus })
  @IsOptional()
  @IsEnum(ControlNodeStatus)
  status?: ControlNodeStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  evidenceUrl?: string | null;
}

export class BulkProgressDto {
  @ApiProperty({ type: [CreateProgressDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProgressDto)
  items!: CreateProgressDto[];
}

export class CreateBaselineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(VALIDATION.TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ example: '1405/04/25' })
  @IsJalaliDate()
  statusDate!: string;
}

export class CreateAssignmentDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalResourceName?: string | null;

  @ApiPropertyOptional({ enum: AssignmentRole, default: AssignmentRole.OWNER })
  @IsOptional()
  @IsEnum(AssignmentRole)
  role?: AssignmentRole;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  allocationPercent?: number | null;
}

export class GanttQueryDto {
  @IsOptional() @IsJalaliDate() from?: string;
  @IsOptional() @IsJalaliDate() to?: string;
  @IsOptional() @IsString() zoom?: string;
  @IsOptional() @IsUUID() phaseId?: string;
  @IsOptional() @IsString() owner?: string;
  @IsOptional() @IsEnum(ControlNodeStatus) status?: ControlNodeStatus;
  @IsOptional() @IsBoolean() @Type(() => Boolean) criticalOnly?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) includeBaseline?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) includeActual?: boolean;
  @IsOptional() @IsString() search?: string;
}
