import {
  countDerivedBarCells,
  deriveSpansForTask,
  evaluateStyleGantt,
  isKnownCfFormula,
  isPlanPeriod,
  isActualBeyondPeriod,
  isPercentCompleteBeyondPeriod,
} from './gantt-cf-evaluator';
import { readGanttConditionalFormattingRules } from './gantt-cf-ooxml';
import { buildStyleGanttFixtureBuffer } from './__fixtures__/style-gantt-fixture';
import { GanttExcelParserService } from './gantt-excel-parser.service';

describe('gantt-cf-evaluator', () => {
  it('parses allowlisted named formulas only', () => {
    expect(isKnownCfFormula('Plan')).toBe(true);
    expect(isKnownCfFormula('ActualBeyond')).toBe(true);
    expect(isKnownCfFormula('INDIRECT("A1")')).toBe(false);
    expect(isKnownCfFormula('=cmd|')).toBe(false);
  });

  it('derives planned / actual / progress spans', () => {
    const issues: Parameters<typeof deriveSpansForTask>[3] = [];
    const spans = deriveSpansForTask(
      {
        sourceRow: 5,
        planStart: 1,
        planDuration: 10,
        actualStart: 1,
        actualDuration: 12,
        percentComplete: 0.5,
      },
      1,
      147,
      issues,
    );
    expect(issues).toHaveLength(0);
    const planned = spans.find((s) => s.spanType === 'PLANNED');
    const actual = spans.find((s) => s.spanType === 'ACTUAL');
    const progress = spans.find((s) => s.spanType === 'PROGRESS');
    expect(planned).toMatchObject({ startPeriodIndex: 1, endPeriodIndex: 10 });
    expect(actual).toMatchObject({ startPeriodIndex: 1, endPeriodIndex: 12 });
    expect(progress?.startPeriodIndex).toBe(1);
    expect(progress?.progressEndPeriodIndex).toBeDefined();
  });

  it('keeps zero progress without PROGRESS span', () => {
    const issues: Parameters<typeof deriveSpansForTask>[3] = [];
    const spans = deriveSpansForTask(
      {
        sourceRow: 6,
        planStart: 5,
        planDuration: 4,
        actualStart: 5,
        actualDuration: 4,
        percentComplete: 0,
      },
      1,
      147,
      issues,
    );
    expect(spans.some((s) => s.spanType === 'PROGRESS')).toBe(false);
    expect(spans.some((s) => s.spanType === 'PLANNED')).toBe(true);
  });

  it('does not create span without schedule', () => {
    const issues: Parameters<typeof deriveSpansForTask>[3] = [];
    const spans = deriveSpansForTask(
      {
        sourceRow: 7,
        planStart: null,
        planDuration: null,
        actualStart: null,
        actualDuration: null,
        percentComplete: null,
      },
      1,
      147,
      issues,
    );
    expect(spans).toHaveLength(0);
  });

  it('fails reversed span', () => {
    const issues: Parameters<typeof deriveSpansForTask>[3] = [];
    const spans = deriveSpansForTask(
      {
        sourceRow: 9,
        planStart: 20,
        planDuration: -3,
        actualStart: null,
        actualDuration: null,
        percentComplete: null,
      },
      1,
      147,
      issues,
    );
    expect(spans).toHaveLength(0);
    expect(issues.some((i) => i.level === 'CRITICAL' && i.message.includes('معکوس'))).toBe(
      true,
    );
  });

  it('clamps periods into 1..147', () => {
    const issues: Parameters<typeof deriveSpansForTask>[3] = [];
    const spans = deriveSpansForTask(
      {
        sourceRow: 10,
        planStart: 140,
        planDuration: 20,
        actualStart: null,
        actualDuration: null,
        percentComplete: null,
      },
      1,
      147,
      issues,
    );
    const planned = spans.find((s) => s.spanType === 'PLANNED')!;
    expect(planned.startPeriodIndex).toBeGreaterThanOrEqual(1);
    expect(planned.endPeriodIndex).toBeLessThanOrEqual(147);
  });

  it('warns on unknown CF expression', () => {
    const result = evaluateStyleGantt({
      tasks: [],
      periodColumnCount: 147,
      rules: [
        {
          type: 'expression',
          priority: 1,
          stopIfTrue: false,
          range: 'O5:FE146',
          formula: 'UNKNOWN_FORMULA()',
          dxfId: 0,
          semanticMeaning: 'OTHER',
          known: false,
        },
      ],
    });
    expect(result.unknownRuleCount).toBe(1);
    expect(result.issues.some((i) => i.level === 'WARNING')).toBe(true);
  });

  it('counts derived bar cells from span union', () => {
    const spans = [
      {
        sourceRow: 5,
        spanType: 'PLANNED' as const,
        startPeriodIndex: 1,
        endPeriodIndex: 3,
        progressEndPeriodIndex: null,
        derivationMethod: 'EXCEL_CONDITIONAL_FORMATTING' as const,
      },
      {
        sourceRow: 5,
        spanType: 'ACTUAL' as const,
        startPeriodIndex: 2,
        endPeriodIndex: 5,
        progressEndPeriodIndex: null,
        derivationMethod: 'EXCEL_CONDITIONAL_FORMATTING' as const,
      },
    ];
    expect(countDerivedBarCells(spans)).toBe(5);
  });

  it('matches PeriodInPlan / ActualBeyond cell predicates', () => {
    expect(isPlanPeriod(3, 1, 5)).toBe(true);
    expect(isPlanPeriod(6, 1, 5)).toBe(false);
    expect(isActualBeyondPeriod(12, 10, 5)).toBe(true);
    expect(isPercentCompleteBeyondPeriod(1, 1, 10, 0.5)).toBe(true);
    expect(isPercentCompleteBeyondPeriod(1, 1, 10, 0)).toBe(false);
  });
});

describe('style-gantt fixture parse', () => {
  const parser = new GanttExcelParserService();

  it('extracts 147 period definitions with zero explicit snapshots', async () => {
    const buffer = await buildStyleGanttFixtureBuffer();
    const parsed = await parser.parse(buffer);
    expect(parsed.periodColumns).toHaveLength(147);
    expect(parsed.periodMatrixStats.explicitPeriodSnapshots).toBe(0);
    expect(parsed.periodValues).toHaveLength(0);
    expect(parsed.periodMatrixStats.timelineClassification).toBe('STYLE_BASED_GANTT');
    expect(parsed.periodMatrixStats.conditionalFormattingRuleCount).toBe(11);
    expect(parsed.ganttSpans.length).toBeGreaterThan(0);
    expect(parsed.periodMatrixStats.derivedBarCellCount).toBe(
      countDerivedBarCells(parsed.ganttSpans),
    );
    expect(
      parsed.issues.some(
        (i) => i.code === 'STYLE_BASED_GANTT' && i.level === 'INFO',
      ),
    ).toBe(true);
    expect(
      parsed.issues.some((i) => i.message.includes('هیچ مقدار دوره‌ای پیدا نشد')),
    ).toBe(false);
  });

  it('reads 11 CF rules from OOXML without executing formulas', async () => {
    const buffer = await buildStyleGanttFixtureBuffer();
    const rules = await readGanttConditionalFormattingRules(buffer);
    expect(rules).toHaveLength(11);
    expect(rules.every((r) => r.type === 'dataBar' || r.known || r.formula)).toBeTruthy();
  });
});
