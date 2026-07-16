/**
 * سازندهٔ Fixture اکسل گانت — Sanitized و قطعی (Deterministic).
 * این Fixture ساختار و شمارش‌های فایل واقعی را بازتولید می‌کند بدون هیچ دادهٔ محرمانه،
 * تا تست‌ها در CI بدون نیاز به فایل واقعی و بدون Commit فایل خام اجرا شوند.
 *
 * مرجع اعداد: docs/project-control/source-analysis.md
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
const DATE_ROWS = 65; // غیرخالی
const VALID_DATE_ROWS = 60; // معتبر (۵ نامعتبر)
const DATE_MIN = '1404/09/01';
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
    // Break2 عنوان با تورفتگی
    const title = `فعالیت ${s.gidx + 1}`;
    ws.getCell(r, COL.break2).value = `${' '.repeat(s.indent)}${title}`;

    // Phase (مقدار فقط روی ردیف اول، سپس Merge)
    if (s.phaseFirstRow) {
      ws.getCell(r, COL.phase).value = `فاز ${s.phaseIndex + 1}`;
    }
    // Break1 (مقدار روی ردیف اول گروه)
    if (s.break1GroupFirstRow) {
      ws.getCell(r, COL.break1).value = `شکست ${s.phaseIndex + 1}-${s.break1Idx}`;
    }

    // مسئول / DOD / درصد
    if (s.gidx < OWNER_ROWS) ws.getCell(r, COL.owner).value = `مسئول ${s.gidx + 1}`;
    if (s.gidx < DOD_ROWS) ws.getCell(r, COL.dod).value = `تعریف اتمام ${s.gidx + 1}`;
    if (s.gidx < PROGRESS_ROWS) ws.getCell(r, COL.percent).value = 50;

    // تاریخ‌ها: ۶۵ غیرخالی، ۶۰ معتبر، ۵ نامعتبر
    if (s.gidx < DATE_ROWS) {
      if (s.gidx < VALID_DATE_ROWS) {
        ws.getCell(r, COL.start).value = DATE_MIN;
        ws.getCell(r, COL.finish).value = DATE_MAX;
      } else {
        ws.getCell(r, COL.start).value = 'نامشخص';
        ws.getCell(r, COL.finish).value = 'نامشخص';
      }
    }
  }

  // بودجه: ۵ ردیف در فاز ۵ (متن با پسوند «تومان»)
  const phase5FirstGidx = PHASE_COUNTS.slice(0, 4).reduce((a, b) => a + b, 0);
  BUDGETS.forEach((amount, i) => {
    const gidx = phase5FirstGidx + i;
    const spec = specs.find((s) => s.gidx === gidx)!;
    ws.getCell(spec.excelRow, COL.budget).value = `${amount.toLocaleString('en-US')} تومان`;
  });

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

  // ردیف‌های جمع «روز»/«ماه»
  const totalsRow = FIRST_DATA_ROW + 142; // 147
  ws.getCell(totalsRow, COL.break1).value = 'روز';
  ws.getCell(totalsRow, COL.break2).value = TOTAL_DAYS;
  ws.getCell(totalsRow + 2, COL.break1).value = 'ماه';
  ws.getCell(totalsRow + 2, COL.break2).value = TOTAL_MONTHS;

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
