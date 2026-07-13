import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExcelParserService } from './excel-parser.service';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [AuditModule],
  controllers: [ImportController],
  providers: [ImportService, ExcelParserService],
  exports: [ExcelParserService],
})
export class ImportModule {}
