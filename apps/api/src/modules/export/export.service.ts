import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ACTIVITY_STATUS_META,
  AuditAction,
  DECISION_STATUS_META,
  dateToJalaliString,
  ErrorCode,
  PROBABILITY_META,
  RISK_LEVEL_META,
  sanitizeForSpreadsheet,
} from '@ppm/contracts';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { DashboardCalculationService } from '../calculation/dashboard-calculation.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: DashboardCalculationService,
    private readonly audit: AuditService,
  ) {}

  private styleHeader(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Tahoma' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17345F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  async exportProject(
    projectId: string,
    ctx: AuditContext,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        indicators: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }] },
        monthlyProgress: { orderBy: { sortOrder: 'asc' } },
        activities: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        risks: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        decisions: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!project) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'سامانه پایش پیشرفت پروژه';
    wb.created = new Date();

    const activityInputs = project.activities.map((a) => ({
      weightPercent: a.weightPercent,
      plannedPercent: a.plannedPercent,
      actualPercent: a.actualPercent,
    }));
    const planned = this.calc.plannedProjectProgress(activityInputs);
    const actual = this.calc.actualProjectProgress(activityInputs);

    // شیت ۱: اطلاعات پروژه
    const wsProject = wb.addWorksheet('اطلاعات پروژه', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    wsProject.columns = [
      { header: 'عنوان', key: 'k', width: 30 },
      { header: 'مقدار', key: 'v', width: 60 },
    ];
    this.styleHeader(wsProject.getRow(1));
    const primary = project.indicators.find((i) => i.isPrimary) ?? project.indicators[0];
    const rows: Array<[string, string]> = [
      ['نام پروژه', [project.titleFa, project.titleEn].filter(Boolean).join('\n')],
      ['کد پروژه', project.projectCode ?? ''],
      ['مسئول پروژه', project.projectManager],
      ['نوع پروژه', project.projectType],
      ['بودجه مصوب (میلیارد ریال)', String(project.budgetBillionRial)],
      ['تاریخ شروع', dateToJalaliString(project.startDate)],
      ['تاریخ پایان برنامه‌ای', dateToJalaliString(project.plannedEndDate)],
      ['آخرین به‌روزرسانی', dateToJalaliString(project.reportDate)],
      ['پیشرفت برنامه‌ای کل (%)', String(planned)],
      ['پیشرفت واقعی کل (%)', String(actual)],
      ['نام شاخص اثربخشی', primary?.title ?? ''],
      ['مقدار برنامه‌ای شاخص', String(primary?.plannedValue ?? '')],
      ['مقدار واقعی شاخص', String(primary?.actualValue ?? '')],
      ['شرح پروژه', project.description],
    ];
    for (const [k, v] of rows) {
      wsProject.addRow({ k: sanitizeForSpreadsheet(k), v: sanitizeForSpreadsheet(v) });
    }

    // شیت ۲: پیشرفت ماهیانه
    const wsMonthly = wb.addWorksheet('پیشرفت ماهیانه', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    wsMonthly.columns = [
      { header: 'ماه', key: 'month', width: 20 },
      { header: 'برنامه (%)', key: 'planned', width: 14 },
      { header: 'واقعی (%)', key: 'actual', width: 14 },
      { header: 'انحراف (%)', key: 'deviation', width: 14 },
    ];
    this.styleHeader(wsMonthly.getRow(1));
    project.monthlyProgress.forEach((m, idx) => {
      const rowIdx = idx + 2;
      const row = wsMonthly.addRow({
        month: sanitizeForSpreadsheet(m.monthLabel),
        planned: m.plannedPercent,
        actual: m.actualPercent,
      });
      // فرمول انحراف = واقعی - برنامه (فقط اگر واقعی موجود باشد)
      if (m.actualPercent !== null && m.actualPercent !== undefined) {
        wsMonthly.getCell(`D${rowIdx}`).value = { formula: `C${rowIdx}-B${rowIdx}` };
      }
      row.getCell('planned').numFmt = '0.0';
      row.getCell('actual').numFmt = '0.0';
      row.getCell('deviation').numFmt = '0.0';
    });

    // شیت ۳: فعالیت‌ها
    const wsAct = wb.addWorksheet('فعالیت‌ها', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    wsAct.columns = [
      { header: 'ردیف', key: 'row', width: 8 },
      { header: 'فعالیت', key: 'title', width: 45 },
      { header: 'وزن (%)', key: 'weight', width: 12 },
      { header: 'تاریخ شروع', key: 'start', width: 15 },
      { header: 'تاریخ پایان', key: 'end', width: 15 },
      { header: 'پیشرفت برنامه‌ای(%)', key: 'planned', width: 18 },
      { header: 'پیشرفت واقعی(%)', key: 'actual', width: 18 },
      { header: 'وضعیت', key: 'status', width: 14 },
    ];
    this.styleHeader(wsAct.getRow(1));
    project.activities.forEach((a) => {
      const status = (a.statusOverride ??
        this.calc.computeActivityStatus(a.plannedPercent, a.actualPercent)) as keyof typeof ACTIVITY_STATUS_META;
      wsAct.addRow({
        row: a.rowNumber,
        title: sanitizeForSpreadsheet(a.title),
        weight: a.weightPercent,
        start: sanitizeForSpreadsheet(dateToJalaliString(a.startDate)),
        end: sanitizeForSpreadsheet(dateToJalaliString(a.endDate)),
        planned: a.plannedPercent,
        actual: a.actualPercent,
        status: ACTIVITY_STATUS_META[status].label,
      });
    });
    // سطر جمع وزنی
    const sumRow = wsAct.addRow({
      title: 'جمع',
      weight: { formula: `SUM(C2:C${project.activities.length + 1})` },
    });
    sumRow.font = { bold: true };

    // شیت ۴: ریسک‌ها
    const wsRisk = wb.addWorksheet('ریسک‌ها', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    wsRisk.columns = [
      { header: 'ردیف', key: 'row', width: 8 },
      { header: 'ریسک / چالش', key: 'title', width: 40 },
      { header: 'احتمال', key: 'prob', width: 14 },
      { header: 'سطح ریسک', key: 'level', width: 14 },
      { header: 'اقدام / برنامه مقابله', key: 'action', width: 40 },
      { header: 'مسئول', key: 'owner', width: 16 },
    ];
    this.styleHeader(wsRisk.getRow(1));
    project.risks.forEach((r) => {
      wsRisk.addRow({
        row: r.rowNumber,
        title: sanitizeForSpreadsheet(r.title),
        prob: PROBABILITY_META[r.probability as keyof typeof PROBABILITY_META].label,
        level: RISK_LEVEL_META[r.riskLevel as keyof typeof RISK_LEVEL_META].label,
        action: sanitizeForSpreadsheet(r.mitigationAction),
        owner: sanitizeForSpreadsheet(r.owner),
      });
    });

    // شیت ۵: تصمیمات
    const wsDec = wb.addWorksheet('تصمیمات', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    wsDec.columns = [
      { header: 'ردیف', key: 'row', width: 8 },
      { header: 'موضوع دستور', key: 'subject', width: 30 },
      { header: 'شرح دستور', key: 'desc', width: 40 },
      { header: 'مسئول', key: 'owner', width: 16 },
      { header: 'مهلت اجرا', key: 'due', width: 15 },
      { header: 'وضعیت', key: 'status', width: 16 },
    ];
    this.styleHeader(wsDec.getRow(1));
    project.decisions.forEach((d) => {
      wsDec.addRow({
        row: d.rowNumber,
        subject: sanitizeForSpreadsheet(d.subject ?? ''),
        desc: sanitizeForSpreadsheet(d.description ?? ''),
        owner: sanitizeForSpreadsheet(d.owner ?? ''),
        due: d.dueDate ? sanitizeForSpreadsheet(dateToJalaliString(d.dueDate)) : '',
        status: DECISION_STATUS_META[d.status as keyof typeof DECISION_STATUS_META].label,
      });
    });

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Export',
      entityId: projectId,
      action: AuditAction.EXPORT,
    });

    const safeTitle = project.titleFa.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
    return { buffer, filename: `${safeTitle || 'project'}_${dateToJalaliString(new Date())}.xlsx` };
  }
}
