import { Controller, Get, Param, ParseUUIDPipe, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { getRequestContext } from '../../common/utils/request-context';
import { ExportService } from './export.service';

@ApiTags('export')
@Controller('projects/:projectId/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('excel')
  @ApiOperation({ summary: 'خروجی Excel پروژه (۵ شیت)' })
  async excel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportProject(
      projectId,
      getRequestContext(req),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.end(buffer);
  }
}
