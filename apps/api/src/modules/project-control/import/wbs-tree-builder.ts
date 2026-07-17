/**
 * ساخت درخت WBS از ردیف‌های Parse‌شدهٔ اکسل (Pure، تست‌پذیر، مستقل از Prisma).
 * ریشه (Root) از قبل توسط Control Plan ساخته شده و tempId آن پاس داده می‌شود.
 */
import { type ParsedWbsRow, WbsNodeType } from '@ppm/contracts';

export interface PlannedWbsNode {
  tempId: string;
  parentTempId: string | null;
  nodeType: WbsNodeType;
  code: string | null;
  title: string;
  normalizedTitle: string;
  rawTitle: string | null;
  depth: number;
  sortOrder: number;
  isSummary: boolean;
  isMilestone: boolean;
  sourceRow: number | null;
  outlineLevel: number | null;
  plannedStartJalali: string | null;
  plannedFinishJalali: string | null;
  budgetAmount: number | null;
  ownerText: string | null;
  definitionOfDone: string | null;
  periodPlanStart: number | null;
  periodPlanDuration: number | null;
  periodActualStart: number | null;
  periodActualDuration: number | null;
  percentComplete: number | null;
}

export interface WbsTreePlan {
  nodes: PlannedWbsNode[];
  phaseCount: number;
  break1Count: number;
  taskCount: number;
}

/** ساخت نقشهٔ نودها. rootTempId معمولاً UUID نود ریشهٔ Control Plan است. */
export function buildWbsTree(rows: ParsedWbsRow[], rootTempId: string): WbsTreePlan {
  const nodes: PlannedWbsNode[] = [];
  const phaseByCode = new Map<string, PlannedWbsNode>();
  const break1ByCode = new Map<string, PlannedWbsNode>();
  const childCounter = new Map<string, number>(); // parentTempId → sortOrder
  // Stack نودهای Break2 برای تعیین والد بر اساس Outline Level، به‌ازای هر Break1.
  const outlineStacks = new Map<string, Array<{ level: number; tempId: string }>>();

  let seq = 0;
  const nextId = (prefix: string): string => {
    seq += 1;
    return `${prefix}-${seq}`;
  };
  const nextSort = (parentTempId: string): number => {
    const n = childCounter.get(parentTempId) ?? 0;
    childCounter.set(parentTempId, n + 1);
    return n;
  };

  for (const row of rows) {
    // فاز
    let phase = phaseByCode.get(row.phaseCode);
    if (!phase) {
      const tempId = nextId('phase');
      phase = {
        tempId,
        parentTempId: rootTempId,
        nodeType: WbsNodeType.PHASE,
        code: row.phaseCode,
        title: row.phaseTitle || `فاز ${row.phaseCode}`,
        normalizedTitle: row.phaseTitle || `فاز ${row.phaseCode}`,
        rawTitle: null,
        depth: 1,
        sortOrder: nextSort(rootTempId),
        isSummary: true,
        isMilestone: false,
        sourceRow: null,
        outlineLevel: null,
        plannedStartJalali: null,
        plannedFinishJalali: null,
        budgetAmount: null,
        ownerText: null,
        definitionOfDone: null,
        periodPlanStart: null,
        periodPlanDuration: null,
        periodActualStart: null,
        periodActualDuration: null,
        percentComplete: null,
      };
      phaseByCode.set(row.phaseCode, phase);
      nodes.push(phase);
    }

    // Break1 (اختیاری اما در فایل واقعی همیشه موجود)
    let break1: PlannedWbsNode | null = null;
    if (row.break1Code) {
      break1 = break1ByCode.get(row.break1Code) ?? null;
      if (!break1) {
        const tempId = nextId('break1');
        break1 = {
          tempId,
          parentTempId: phase.tempId,
          nodeType: WbsNodeType.BREAK1,
          code: row.break1Code,
          title: row.break1Title ?? row.break1Code,
          normalizedTitle: row.break1Title ?? row.break1Code,
          rawTitle: null,
          depth: 2,
          sortOrder: nextSort(phase.tempId),
          isSummary: true,
          isMilestone: false,
          sourceRow: null,
          outlineLevel: null,
          plannedStartJalali: null,
          plannedFinishJalali: null,
          budgetAmount: null,
          ownerText: null,
          definitionOfDone: null,
          periodPlanStart: null,
          periodPlanDuration: null,
          periodActualStart: null,
          periodActualDuration: null,
          percentComplete: null,
        };
        break1ByCode.set(row.break1Code, break1);
        outlineStacks.set(row.break1Code, []);
        nodes.push(break1);
      }
    }

    // Break2 (فعالیت) — والد بر اساس Outline Level
    const groupKey = row.break1Code ?? row.phaseCode;
    const stack = outlineStacks.get(groupKey) ?? [];
    if (!outlineStacks.has(groupKey)) outlineStacks.set(groupKey, stack);
    while (stack.length > 0 && stack[stack.length - 1]!.level >= row.outlineLevel) {
      stack.pop();
    }
    const parentNode = stack.length > 0
      ? nodes.find((n) => n.tempId === stack[stack.length - 1]!.tempId)!
      : (break1 ?? phase);

    const tempId = nextId('task');
    const isMilestone =
      row.plannedStartValid &&
      row.plannedFinishValid &&
      row.plannedStartJalali === row.plannedFinishJalali;
    const task: PlannedWbsNode = {
      tempId,
      parentTempId: parentNode.tempId,
      nodeType: isMilestone ? WbsNodeType.MILESTONE : WbsNodeType.TASK,
      code: null,
      title: row.normalizedTitle,
      normalizedTitle: row.normalizedTitle,
      rawTitle: row.rawTitle,
      depth: parentNode.depth + 1,
      sortOrder: nextSort(parentNode.tempId),
      isSummary: false,
      isMilestone,
      sourceRow: row.sourceRow,
      outlineLevel: row.outlineLevel,
      plannedStartJalali: row.plannedStartJalali,
      plannedFinishJalali: row.plannedFinishJalali,
      budgetAmount: row.budgetAmount,
      ownerText: row.ownerText,
      definitionOfDone: row.definitionOfDone,
      periodPlanStart: row.periodPlanStart,
      periodPlanDuration: row.periodPlanDuration,
      periodActualStart: row.periodActualStart,
      periodActualDuration: row.periodActualDuration,
      percentComplete: row.percentComplete,
    };
    nodes.push(task);
    stack.push({ level: row.outlineLevel, tempId });
  }

  // علامت‌گذاری Summary/Type برای Break2هایی که فرزند دارند.
  const hasChildren = new Set<string>();
  for (const n of nodes) {
    if (n.parentTempId) hasChildren.add(n.parentTempId);
  }
  for (const n of nodes) {
    if (n.nodeType === WbsNodeType.TASK && hasChildren.has(n.tempId)) {
      n.nodeType = WbsNodeType.SUMMARY_TASK;
      n.isSummary = true;
    }
  }

  return {
    nodes,
    phaseCount: phaseByCode.size,
    break1Count: break1ByCode.size,
    taskCount: nodes.filter(
      (n) =>
        n.nodeType === WbsNodeType.TASK ||
        n.nodeType === WbsNodeType.SUMMARY_TASK ||
        n.nodeType === WbsNodeType.MILESTONE,
    ).length,
  };
}
