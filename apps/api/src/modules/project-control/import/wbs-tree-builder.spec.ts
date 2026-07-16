import { type ParsedWbsRow, WbsNodeType } from '@ppm/contracts';
import { buildWbsTree } from './wbs-tree-builder';

function row(overrides: Partial<ParsedWbsRow> & { sourceRow: number }): ParsedWbsRow {
  return {
    sourceRow: overrides.sourceRow,
    phaseCode: overrides.phaseCode ?? '1',
    phaseTitle: overrides.phaseTitle ?? 'فاز 1',
    break1Code: overrides.break1Code ?? '1-1',
    break1Title: overrides.break1Title ?? 'شکست 1-1',
    rawTitle: overrides.rawTitle ?? 'فعالیت',
    normalizedTitle: overrides.normalizedTitle ?? 'فعالیت',
    indent: overrides.indent ?? 0,
    outlineLevel: overrides.outlineLevel ?? 0,
    plannedStartJalali: overrides.plannedStartJalali ?? null,
    plannedFinishJalali: overrides.plannedFinishJalali ?? null,
    startProvided: overrides.startProvided ?? false,
    finishProvided: overrides.finishProvided ?? false,
    plannedStartValid: overrides.plannedStartValid ?? false,
    plannedFinishValid: overrides.plannedFinishValid ?? false,
    budgetAmount: overrides.budgetAmount ?? null,
    ownerText: overrides.ownerText ?? null,
    definitionOfDone: overrides.definitionOfDone ?? null,
    periodPlanStart: overrides.periodPlanStart ?? null,
    periodPlanDuration: overrides.periodPlanDuration ?? null,
    periodActualStart: overrides.periodActualStart ?? null,
    periodActualDuration: overrides.periodActualDuration ?? null,
    percentComplete: overrides.percentComplete ?? null,
  };
}

describe('buildWbsTree', () => {
  it('فاز/Break1/فعالیت را با شمارش صحیح می‌سازد', () => {
    const rows = [
      row({ sourceRow: 5, normalizedTitle: 'الف' }),
      row({ sourceRow: 6, normalizedTitle: 'ب' }),
      row({ sourceRow: 7, phaseCode: '2', phaseTitle: 'فاز 2', break1Code: '2-1', normalizedTitle: 'ج' }),
    ];
    const tree = buildWbsTree(rows, 'root');
    expect(tree.phaseCount).toBe(2);
    expect(tree.break1Count).toBe(2);
    expect(tree.taskCount).toBe(3);
    const phase1 = tree.nodes.find((n) => n.nodeType === WbsNodeType.PHASE && n.code === '1')!;
    expect(phase1.parentTempId).toBe('root');
    expect(phase1.depth).toBe(1);
  });

  it('Outline Level والد صحیح تعیین می‌کند و Summary را علامت می‌زند', () => {
    const rows = [
      row({ sourceRow: 5, normalizedTitle: 'والد', outlineLevel: 0 }),
      row({ sourceRow: 6, normalizedTitle: 'فرزند', outlineLevel: 1 }),
      row({ sourceRow: 7, normalizedTitle: 'نوه', outlineLevel: 2 }),
      row({ sourceRow: 8, normalizedTitle: 'خواهر والد', outlineLevel: 0 }),
    ];
    const tree = buildWbsTree(rows, 'root');
    const parent = tree.nodes.find((n) => n.normalizedTitle === 'والد')!;
    const child = tree.nodes.find((n) => n.normalizedTitle === 'فرزند')!;
    const grand = tree.nodes.find((n) => n.normalizedTitle === 'نوه')!;
    const sibling = tree.nodes.find((n) => n.normalizedTitle === 'خواهر والد')!;

    expect(child.parentTempId).toBe(parent.tempId);
    expect(grand.parentTempId).toBe(child.tempId);
    expect(parent.nodeType).toBe(WbsNodeType.SUMMARY_TASK);
    expect(parent.isSummary).toBe(true);
    expect(grand.nodeType).toBe(WbsNodeType.TASK);

    // خواهرِ والد باید فرزند Break1 باشد نه والد.
    const break1 = tree.nodes.find((n) => n.nodeType === WbsNodeType.BREAK1)!;
    expect(sibling.parentTempId).toBe(break1.tempId);
  });

  it('نقطهٔ عطف (Milestone) با شروع=پایان تشخیص داده می‌شود', () => {
    const rows = [
      row({
        sourceRow: 5,
        normalizedTitle: 'تحویل',
        plannedStartValid: true,
        plannedFinishValid: true,
        plannedStartJalali: '1405/01/01',
        plannedFinishJalali: '1405/01/01',
      }),
    ];
    const tree = buildWbsTree(rows, 'root');
    const node = tree.nodes.find((n) => n.normalizedTitle === 'تحویل')!;
    expect(node.isMilestone).toBe(true);
    expect(node.nodeType).toBe(WbsNodeType.MILESTONE);
  });
});
