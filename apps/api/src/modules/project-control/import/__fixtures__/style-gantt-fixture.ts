/**
 * Fixture عمومی STYLE_BASED_GANTT — بدون دادهٔ محرمانه.
 * ماتریس O..FE خالی است؛ نوارها از J/K/L/M/N + CF مشتق می‌شوند.
 */
import ExcelJS from 'exceljs';

const PHASE_COUNTS = [13, 18, 12, 13, 65, 10, 11];
const BREAK1_PER_PHASE = [3, 4, 3, 3, 5, 3, 3];
const PERIODS = 147;
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 5;
const COL = {
  phase: 2,
  break1: 3,
  break2: 4,
  start: 5,
  finish: 6,
  budget: 7,
  owner: 8,
  dod: 9,
  planStart: 10,
  planDuration: 11,
  actualStart: 12,
  actualDuration: 13,
  percent: 14,
  firstPeriod: 15,
};

function groupSizes(total: number, groups: number): number[] {
  const base = Math.floor(total / groups);
  const rem = total % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < rem ? 1 : 0));
}

export async function buildStyleGanttFixtureBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('گانت');

  ws.getCell(2, COL.firstPeriod).value = 50; // period_selected
  ws.getCell(2, COL.firstPeriod + 3).value = 'Plan Duration';
  ws.getCell(2, COL.firstPeriod + 9).value = 'Actual Start';

  ws.getCell(HEADER_ROW, COL.phase).value = 'Phase';
  ws.getCell(HEADER_ROW, COL.break1).value = 'Break1';
  ws.getCell(HEADER_ROW, COL.break2).value = 'Break 2';
  ws.getCell(HEADER_ROW, COL.start).value = 'تاریخ شروع';
  ws.getCell(HEADER_ROW, COL.finish).value = 'تاریخ پایان';
  ws.getCell(HEADER_ROW, COL.budget).value = 'مبلغ پیشنهادی';
  ws.getCell(HEADER_ROW, COL.owner).value = 'مسئول انجام';
  ws.getCell(HEADER_ROW, COL.dod).value = 'DOD';
  ws.getCell(HEADER_ROW, COL.planStart).value = 'PLAN START';
  ws.getCell(HEADER_ROW, COL.planDuration).value = 'DURATION';
  ws.getCell(HEADER_ROW, COL.actualStart).value = 'ACTUAL START';
  ws.getCell(HEADER_ROW, COL.actualDuration).value = 'ACTUAL DURATION';
  ws.getCell(HEADER_ROW, COL.percent).value = 'PERCENT COMPLETE';
  ws.getCell(HEADER_ROW, COL.firstPeriod).value = 'PERIODS';

  for (let i = 0; i < PERIODS; i += 1) {
    ws.getCell(HEADER_ROW + 1, COL.firstPeriod + i).value = i + 1;
  }

  // Named formulas — sanitized structural (sheet-local style via workbook names)
  wb.definedNames.add(
    'PeriodInPlan',
    'گانت!$A$4=MEDIAN(گانت!$A$4,گانت!$J1,گانت!$J1+گانت!$K1-1)',
  );
  wb.definedNames.add('Plan', 'گانت!PeriodInPlan*(گانت!$J1>0)');
  wb.definedNames.add(
    'PeriodInActual',
    'گانت!$A$4=MEDIAN(گانت!$A$4,گانت!$L1,گانت!$L1+گانت!$M1-1)',
  );
  wb.definedNames.add('ActualBeyond', 'گانت!PeriodInActual*(گانت!$L1>0)');
  wb.definedNames.add('Actual', '(گانت!PeriodInActual*(گانت!$L1>0))*گانت!PeriodInPlan');
  wb.definedNames.add(
    'PercentCompleteBeyond',
    '(گانت!$A$4=MEDIAN(گانت!$A$4,گانت!$L1,گانت!$L1+گانت!$M1)*(گانت!$L1>0))*((گانت!$A$4<(INT(گانت!$L1+گانت!$M1*گانت!$N1)))+(گانت!$A$4=گانت!$L1))*(گانت!$N1>0)',
  );
  wb.definedNames.add('PercentComplete', 'گانت!PercentCompleteBeyond*گانت!PeriodInPlan');
  wb.definedNames.add('period_selected', 'گانت!$O$2');

  const lastData = FIRST_DATA_ROW + 141;
  const matrixRef = `O5:FE${lastData}`;
  ws.addConditionalFormatting({
    ref: 'O4:FE4',
    rules: [
      {
        type: 'expression',
        formulae: ['O$4=period_selected'],
        priority: 84,
      },
    ],
  });
  ws.addConditionalFormatting({
    ref: matrixRef,
    rules: [
      { type: 'expression', formulae: ['PercentComplete'], priority: 28 },
      { type: 'expression', formulae: ['PercentCompleteBeyond'], priority: 29 },
      { type: 'expression', formulae: ['Actual'], priority: 30 },
      { type: 'expression', formulae: ['ActualBeyond'], priority: 31 },
      { type: 'expression', formulae: ['Plan'], priority: 32 },
      { type: 'expression', formulae: ['O$4=period_selected'], priority: 33 },
      { type: 'expression', formulae: ['MOD(COLUMN(),2)'], priority: 34 },
      { type: 'expression', formulae: ['MOD(COLUMN(),2)=0'], priority: 35 },
    ],
  });
  ws.addConditionalFormatting({
    ref: `N5:N${lastData}`,
    rules: [
      {
        type: 'dataBar',
        priority: 294,
        cfvo: [
          { type: 'min' },
          { type: 'max' },
        ],
        color: { argb: 'FF7030A0' },
      } as ExcelJS.ConditionalFormattingRule,
      {
        type: 'dataBar',
        priority: 295,
        cfvo: [
          { type: 'min' },
          { type: 'max' },
        ],
        color: { argb: 'FF92D050' },
      } as ExcelJS.ConditionalFormattingRule,
    ],
  });

  let gidx = 0;
  for (let p = 0; p < PHASE_COUNTS.length; p += 1) {
    const phaseCount = PHASE_COUNTS[p]!;
    const phaseStart = FIRST_DATA_ROW + gidx;
    const phaseEnd = phaseStart + phaseCount - 1;
    const sizes = groupSizes(phaseCount, BREAK1_PER_PHASE[p]!);
    let within = 0;
    sizes.forEach((size, b1) => {
      const gStart = phaseStart + within;
      const gEnd = gStart + size - 1;
      for (let k = 0; k < size; k += 1) {
        const r = gStart + k;
        ws.getCell(r, COL.break2).value = `Task ${gidx + 1}`;
        if (k === 0) ws.getCell(r, COL.break1).value = `Group ${p + 1}-${b1 + 1}`;
        if (r === phaseStart) ws.getCell(r, COL.phase).value = `Phase ${p + 1}`;

        // Sample schedules — no confidential values
        if (gidx === 0) {
          // Planned + Actual + Progress
          ws.getCell(r, COL.planStart).value = 1;
          ws.getCell(r, COL.planDuration).value = 10;
          ws.getCell(r, COL.actualStart).value = 1;
          ws.getCell(r, COL.actualDuration).value = 12;
          ws.getCell(r, COL.percent).value = 0.5;
        } else if (gidx === 1) {
          // Zero progress preserved
          ws.getCell(r, COL.planStart).value = 5;
          ws.getCell(r, COL.planDuration).value = 4;
          ws.getCell(r, COL.actualStart).value = 5;
          ws.getCell(r, COL.actualDuration).value = 4;
          ws.getCell(r, COL.percent).value = 0;
        } else if (gidx === 2) {
          // No span
          ws.getCell(r, COL.percent).value = null;
        } else if (gidx < 70) {
          ws.getCell(r, COL.planStart).value = 1 + (gidx % 20);
          ws.getCell(r, COL.planDuration).value = 3 + (gidx % 5);
          ws.getCell(r, COL.actualStart).value = 1 + (gidx % 20);
          ws.getCell(r, COL.actualDuration).value = 4 + (gidx % 6);
          ws.getCell(r, COL.percent).value = 0.25;
        }
        // Period matrix cells intentionally left blank (STYLE_BASED)
        gidx += 1;
      }
      if (gEnd > gStart) ws.mergeCells(gStart, COL.break1, gEnd, COL.break1);
      within += size;
    });
    if (phaseEnd > phaseStart) ws.mergeCells(phaseStart, COL.phase, phaseEnd, COL.phase);
  }

  ws.getCell(FIRST_DATA_ROW + 142, COL.break1).value = 'جمع کل';
  ws.getCell(FIRST_DATA_ROW + 143, COL.break1).value = 'روز';
  ws.getCell(FIRST_DATA_ROW + 143, COL.break2).value = 620;
  ws.getCell(FIRST_DATA_ROW + 144, COL.break1).value = 'ماه';
  ws.getCell(FIRST_DATA_ROW + 144, COL.break2).value = 21;

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
