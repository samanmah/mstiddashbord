import { ImportIssueCode, ImportIssueLevel } from '@ppm/contracts';
import ExcelJS from 'exceljs';
import {
  buildGanttFixtureBuffer,
  buildSanitizedEdgeFixtureBuffer,
} from './__fixtures__/gantt-fixture';
import { GanttExcelParserService } from './gantt-excel-parser.service';
import { readPeriodMatrix } from './period-matrix';
import { buildWbsTree } from './wbs-tree-builder';

describe('period-matrix', () => {
  const parser = new GanttExcelParserService();

  it('Fixture کامل: ۱۴۷ ستون دوره‌ای شناسایی می‌شود', async () => {
    const buffer = await buildGanttFixtureBuffer();
    const parsed = await parser.parse(buffer);
    expect(parsed.periodMatrixStats.periodColumnCount).toBe(147);
    expect(parsed.periodColumns).toHaveLength(147);
    expect(parsed.periodColumns[0]?.periodIndex).toBe(1);
    expect(parsed.periodColumns[146]?.periodIndex).toBe(147);
  });

  it('صفر Persist می‌شود و blank Persist نمی‌شود', async () => {
    const buffer = await buildGanttFixtureBuffer();
    const parsed = await parser.parse(buffer);
    const zeros = parsed.periodValues.filter((v) => v.zeroIsExplicit && v.normalizedValue === 0);
    expect(zeros.length).toBeGreaterThan(0);
    expect(parsed.periodMatrixStats.explicitZeroCount).toBe(zeros.length);
    // blankها در stats.blankSkippedCount هستند و در periodValues نیستند
    expect(parsed.periodMatrixStats.blankSkippedCount).toBeGreaterThan(0);
    expect(parsed.periodValues.every((v) => v.normalizedValue !== null || v.rawValue !== null)).toBe(
      true,
    );
  });

  it('null با صفر یکی نمی‌شود', async () => {
    const buffer = await buildSanitizedEdgeFixtureBuffer();
    const parsed = await parser.parse(buffer);
    const blankish = parsed.periodValues.filter((v) => v.normalizedValue === null);
    // مقادیر غیرعددی ممکن است null باشند؛ صفرها جدا هستند
    const zeros = parsed.periodValues.filter((v) => v.normalizedValue === 0);
    expect(zeros.every((v) => v.zeroIsExplicit)).toBe(true);
    expect(blankish.every((v) => v.zeroIsExplicit === false)).toBe(true);
  });

  it('فرمول cached خوانده می‌شود و بدون cache Warning می‌دهد', async () => {
    const buffer = await buildSanitizedEdgeFixtureBuffer();
    const parsed = await parser.parse(buffer);
    const cached = parsed.periodValues.find((v) => v.formula && v.normalizedValue === 5);
    expect(cached).toBeTruthy();
    expect(parsed.periodMatrixStats.formulaCount).toBeGreaterThan(0);
    expect(parsed.periodMatrixStats.formulaWithoutCachedResultCount).toBeGreaterThan(0);
    expect(
      parsed.issues.some(
        (i) =>
          i.code === ImportIssueCode.EMPTY_PERIOD && i.level === ImportIssueLevel.WARNING,
      ),
    ).toBe(true);
  });

  it('planned و actual از هم تفکیک می‌شوند و periodIndex/source حفظ می‌شود', async () => {
    const buffer = await buildGanttFixtureBuffer();
    const parsed = await parser.parse(buffer);
    expect(parsed.periodMatrixStats.plannedCount).toBeGreaterThan(0);
    expect(parsed.periodMatrixStats.actualCount).toBeGreaterThan(0);
    const planned = parsed.periodValues.find((v) => v.valueType === 'PLANNED');
    const actual = parsed.periodValues.find((v) => v.valueType === 'ACTUAL');
    expect(planned?.periodIndex).toBeGreaterThan(0);
    expect(actual?.periodIndex).toBeGreaterThan(0);
    expect(planned?.sourceRow).toBeGreaterThan(0);
    expect(planned?.sourceColumn).toBeGreaterThanOrEqual(15);
    expect(actual?.sourceColumn).toBeGreaterThan(planned!.sourceColumn);
  });

  it('۱۷۳ نود Preview و ۱۷۴ با Root', async () => {
    const buffer = await buildGanttFixtureBuffer();
    const parsed = await parser.parse(buffer);
    const tree = buildWbsTree(parsed.rows, 'root');
    expect(tree.nodes.length).toBe(173);
    expect(tree.nodes.length + 1).toBe(174);
    expect(tree.phaseCount).toBe(7);
    expect(tree.break1Count).toBe(24);
    expect(tree.taskCount).toBe(142);
  });

  it('readPeriodMatrix روی workbook سفارشی blank را صفر نمی‌کند', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('گانت');
    ws.getCell(2, 15).value = 'Plan Duration';
    ws.getCell(3, 15).value = 'PERIODS';
    ws.getCell(4, 15).value = 1;
    ws.getCell(4, 16).value = 2;
    ws.getCell(5, 15).value = 0;
    // 5,16 blank
    const result = readPeriodMatrix(ws, 3, [5]);
    expect(result.periodColumns).toHaveLength(2);
    expect(result.periodValues).toHaveLength(1);
    expect(result.periodValues[0]?.normalizedValue).toBe(0);
    expect(result.periodValues[0]?.zeroIsExplicit).toBe(true);
    expect(result.stats.blankSkippedCount).toBe(1);
  });
});
