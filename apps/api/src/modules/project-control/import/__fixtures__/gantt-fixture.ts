/**
 * سازندهٔ Fixture اکسل گانت — Sanitized و قطعی (Deterministic).
 * ساختار فایل واقعی را بازتولید می‌کند بدون هیچ عنوان/دادهٔ محرمانه.
 *
 * پوشش ویژه:
 * - Header ردیف ۳، Period index ردیف ۴، Data از ردیف ۵
 * - Phase/Break merge + fill-down
 * - عنوان Activity شامل «روز» و Break1 شامل «ماه» (نباید Totals شوند)
 * - Totals با «جمع کل» + برچسب‌های Exact «روز»/«ماه»
 * - Percent مقیاس 0..1، Percent صفر، Budget صفر
 * - تاریخ "-"، ارقام فارسی، ستون‌های O+
 */
import ExcelJS from 'exceljs';

const PHASE_COUNTS = [13, 18, 12, 13, 65, 10, 11]; // جمع = 142
const BREAK1_PER_PHASE = [3, 4, 3, 3, 5, 3, 3]; // جمع = 24
const PERIODS = 147;
const TOTAL_DAYS = 620;
const TOTAL_MONTHS = 21;
const BUDGETS = [875_000_000, 15_000_000_000, 150_000_000_000, 300_000_000_000, 464_000_000_000];
const OWNER_ROWS = 65;
const DOD_ROWS = 48;
const PROGRESS_ROWS = 104;
const VALID_DATE_ROWS = 60;
const DATE_MIN = '1404/09/01';
const DATE_MIN_FA = '۱۴۰۴/۰۹/۰۱';
const DATE_MAX = '1406/12/10';

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
  percent: 14,
  firstPeriod: 15,
};

interface RowSpec {
  gidx: number;
  excelRow: number;
  phaseIndex: number; // 0-based
  phaseFirstRow: boolean;
  phaseRange: [number, number];
  break1GroupFirstRow: boolean;
  break1Range: [number, number];
  break1Idx: number; // 1-based داخل فاز
  indent: number;
}

function groupSizes(total: number, groups: number): number[] {
  const base = Math.floor(total / groups);
  const rem = total % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < rem ? 1 : 0));
}

function planRows(): RowSpec[] {
  const specs: RowSpec[] = [];
  let gidx = 0;
  for (let p = 0; p < PHASE_COUNTS.length; p += 1) {
    const phaseCount = PHASE_COUNTS[p]!;
    const phaseStartRow = FIRST_DATA_ROW + gidx;
    const phaseEndRow = phaseStartRow + phaseCount - 1;
    const sizes = groupSizes(phaseCount, BREAK1_PER_PHASE[p]!);
    let withinPhase = 0;
    sizes.forEach((size, b1) => {
      const groupStartRow = phaseStartRow + withinPhase;
      const groupEndRow = groupStartRow + size - 1;
      for (let k = 0; k < size; k += 1) {
        const excelRow = groupStartRow + k;
        specs.push({
          gidx,
          excelRow,
          phaseIndex: p,
          phaseFirstRow: excelRow === phaseStartRow,
          phaseRange: [phaseStartRow, phaseEndRow],
          break1GroupFirstRow: k === 0,
          break1Range: [groupStartRow, groupEndRow],
          break1Idx: b1 + 1,
          indent: 0,
        });
        gidx += 1;
      }
      withinPhase += size;
    });
  }
  // چند ردیف با تورفتگی برای آزمودن Outline/Summary (فاز ۵).
  const phase5Start = FIRST_DATA_ROW + PHASE_COUNTS.slice(0, 4).reduce((a, b) => a + b, 0);
  const indentTargets: Array<[number, number]> = [
    [phase5Start + 5, 3],
    [phase5Start + 6, 6],
    [phase5Start + 7, 3],
  ];
  for (const [row, indent] of indentTargets) {
    const s = specs.find((x) => x.excelRow === row);
    if (s) s.indent = indent;
  }
  return specs;
}

export async function buildGanttFixtureBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('گانت');

  // گروه‌های ردیف ۲ (fill-forward) — ساختار مشابه فایل واقعی بدون دادهٔ واقعی
  ws.getCell(HEADER_ROW - 1, COL.firstPeriod).value = 'Plan Duration';
  ws.getCell(HEADER_ROW - 1, COL.firstPeriod + 9).value = 'Actual Start';
  ws.getCell(HEADER_ROW - 1, COL.firstPeriod + 14).value = '% Complete';
  ws.getCell(HEADER_ROW - 1, COL.firstPeriod + 19).value = 'Actual (beyond plan)';

  // سربرگ (ردیف ۳)
  ws.getCell(HEADER_ROW, COL.phase).value = 'Phase ';
  ws.getCell(HEADER_ROW, COL.break1).value = 'Break1';
  ws.getCell(HEADER_ROW, COL.break2).value = 'Break 2';
  ws.getCell(HEADER_ROW, COL.start).value = 'تاریخ شروع';
  ws.getCell(HEADER_ROW, COL.finish).value = 'تاریخ پایان';
  ws.getCell(HEADER_ROW, COL.budget).value = 'مبلغ پیشنهادی';
  ws.getCell(HEADER_ROW, COL.owner).value = 'مسئول انجام';
  ws.getCell(HEADER_ROW, COL.dod).value = 'DOD';
  ws.getCell(HEADER_ROW, COL.percent).value = 'PERCENT COMPLETE';
  ws.getCell(HEADER_ROW, COL.firstPeriod).value = 'PERIODS';

  // شماره‌گذاری دوره‌ها (ردیف ۴): ستون O..
  for (let i = 0; i < PERIODS; i += 1) {
    ws.getCell(HEADER_ROW + 1, COL.firstPeriod + i).value = i + 1;
  }

  const specs = planRows();

  for (const s of specs) {
    const r = s.excelRow;
    // عنوان‌های شامل «روز»/«ماه» برای اطمینان از عدم False-positive Totals
    let title = `فعالیت ${s.gidx + 1}`;
    if (s.gidx === 0) title = `فعالیت نمونه روز اول`;
    if (s.gidx === 1) title = `بررسی گزارش ماه جاری`;
    ws.getCell(r, COL.break2).value = `${' '.repeat(s.indent)}${title}`;

    if (s.phaseFirstRow) {
      ws.getCell(r, COL.phase).value = `فاز ${s.phaseIndex + 1}`;
    }
    if (s.break1GroupFirstRow) {
      // یک Break1 با کلمه «ماه» در وسط عنوان (نباید Totals شود)
      if (s.phaseIndex === 0 && s.break1Idx === 2) {
        ws.getCell(r, COL.break1).value = `شکست ماهانه ${s.phaseIndex + 1}-${s.break1Idx}`;
      } else {
        ws.getCell(r, COL.break1).value = `شکست ${s.phaseIndex + 1}-${s.break1Idx}`;
      }
    }

    if (s.gidx < OWNER_ROWS) ws.getCell(r, COL.owner).value = `مسئول ${s.gidx + 1}`;
    if (s.gidx < DOD_ROWS) ws.getCell(r, COL.dod).value = `تعریف اتمام ${s.gidx + 1}`;

    // Percent در مقیاس 0..1 (با یک صفر معتبر)
    if (s.gidx < PROGRESS_ROWS) {
      ws.getCell(r, COL.percent).value = s.gidx === 2 ? 0 : 0.5;
    }

    // تاریخ: ۶۰ معتبر + ۵ خط تیره (null) — یک تاریخ با ارقام فارسی
    if (s.gidx < VALID_DATE_ROWS) {
      ws.getCell(r, COL.start).value = s.gidx === 0 ? DATE_MIN_FA : DATE_MIN;
      ws.getCell(r, COL.finish).value = DATE_MAX;
    } else if (s.gidx < VALID_DATE_ROWS + 5) {
      ws.getCell(r, COL.start).value = '-';
      ws.getCell(r, COL.finish).value = '—';
    }

    // ماتریس دوره‌ای sanitized: صفر صریح، مقدار مثبت، blank، planned/actual
    if (s.gidx === 0) {
      ws.getCell(r, COL.firstPeriod).value = 1; // planned numeric
      ws.getCell(r, COL.firstPeriod + 1).value = 0; // explicit zero
      // blank در COL.firstPeriod + 2
      ws.getCell(r, COL.firstPeriod + 9).value = 3; // actual group
      ws.getCell(r, COL.firstPeriod + 10).value = {
        formula: '1+1',
        result: 2,
      };
      ws.getCell(r, COL.firstPeriod + 11).value = { formula: '2+2' }; // بدون cached result
    } else if (s.gidx === 1) {
      ws.getCell(r, COL.firstPeriod).value = 0;
    } else if (s.gidx === 2) {
      ws.getCell(r, COL.firstPeriod + 9).value = 5;
    }
  }

  // بودجه: ۵ ردیف مثبت + یک صفر معتبر
  const phase5FirstGidx = PHASE_COUNTS.slice(0, 4).reduce((a, b) => a + b, 0);
  BUDGETS.forEach((amount, i) => {
    const gidx = phase5FirstGidx + i;
    const spec = specs.find((s) => s.gidx === gidx)!;
    ws.getCell(spec.excelRow, COL.budget).value = `${amount.toLocaleString('en-US')} تومان`;
  });
  const zeroBudgetSpec = specs.find((s) => s.gidx === phase5FirstGidx + BUDGETS.length)!;
  ws.getCell(zeroBudgetSpec.excelRow, COL.budget).value = 0;

  // Merge فازها و Break1ها
  const mergedPhases = new Set<number>();
  const mergedGroups = new Set<string>();
  for (const s of specs) {
    if (!mergedPhases.has(s.phaseIndex) && s.phaseRange[1] > s.phaseRange[0]) {
      ws.mergeCells(s.phaseRange[0], COL.phase, s.phaseRange[1], COL.phase);
      mergedPhases.add(s.phaseIndex);
    }
    const gkey = `${s.phaseIndex}:${s.break1Range[0]}`;
    if (!mergedGroups.has(gkey) && s.break1Range[1] > s.break1Range[0]) {
      ws.mergeCells(s.break1Range[0], COL.break1, s.break1Range[1], COL.break1);
      mergedGroups.add(gkey);
    }
  }

  // ردیف‌های جمع: «جمع کل» + Exact «روز»/«ماه»
  const totalsRow = FIRST_DATA_ROW + 142; // 147
  ws.getCell(totalsRow, COL.break1).value = 'جمع کل';
  ws.getCell(totalsRow + 1, COL.break1).value = 'روز';
  ws.getCell(totalsRow + 1, COL.break2).value = TOTAL_DAYS;
  ws.getCell(totalsRow + 2, COL.break1).value = 'ماه';
  ws.getCell(totalsRow + 2, COL.break2).value = TOTAL_MONTHS;

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}

/** Fixture کوچک برای تست‌های Totals/Percent بدون ۱۴۲ ردیف. */
export async function buildSanitizedEdgeFixtureBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('گانت');

  ws.getCell(3, 2).value = 'Phase';
  ws.getCell(3, 3).value = 'Break1';
  ws.getCell(3, 4).value = 'Break 2';
  ws.getCell(3, 5).value = 'تاریخ شروع';
  ws.getCell(3, 6).value = 'تاریخ پایان';
  ws.getCell(3, 7).value = 'مبلغ پیشنهادی';
  ws.getCell(2, 15).value = 'Plan Duration';
  ws.getCell(2, 17).value = 'Actual Start';
  ws.getCell(3, 14).value = 'PERCENT COMPLETE';
  ws.getCell(3, 15).value = 'PERIODS';
  ws.getCell(4, 15).value = 1;
  ws.getCell(4, 16).value = 2;
  ws.getCell(4, 17).value = 3;
  ws.getCell(4, 18).value = 4;

  // Phase + Break1 merge across rows 5-7
  ws.getCell(5, 2).value = 'فاز آزمایشی';
  ws.getCell(5, 3).value = 'شکست ماهانه نمونه';
  ws.mergeCells(5, 2, 7, 2);
  ws.mergeCells(5, 3, 7, 3);

  ws.getCell(5, 4).value = 'فعالیت شامل کلمه روز کاری';
  ws.getCell(5, 5).value = '1404/01/01';
  ws.getCell(5, 6).value = '1404/01/10';
  ws.getCell(5, 7).value = 0;
  ws.getCell(5, 14).value = 0;
  ws.getCell(5, 15).value = 1;
  ws.getCell(5, 16).value = 0;
  ws.getCell(5, 17).value = { formula: '10/2', result: 5 };
  // col 18 blank

  ws.getCell(6, 4).value = '  زیرفعالیت ماه جاری';
  ws.getCell(6, 5).value = '-';
  ws.getCell(6, 6).value = '–';
  ws.getCell(6, 14).value = 0.25;
  ws.getCell(6, 15).value = 0;
  ws.getCell(6, 17).value = { formula: '3+3' }; // بدون cached

  ws.getCell(7, 4).value = 'فعالیت پایانی';
  ws.getCell(7, 5).value = '۱۴۰۴/۰۲/۰۱';
  ws.getCell(7, 6).value = '1404/02/20';
  ws.getCell(7, 14).value = 1;

  ws.getCell(8, 3).value = 'جمع کل';
  ws.getCell(9, 3).value = 'مجموع دوره';
  ws.getCell(10, 3).value = 'روز';
  ws.getCell(10, 4).value = 30;
  ws.getCell(11, 3).value = 'ماه';
  ws.getCell(11, 4).value = 1;

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
