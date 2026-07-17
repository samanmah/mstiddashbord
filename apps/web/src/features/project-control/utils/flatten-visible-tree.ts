/**
 * تخت‌کردن درخت WBS برای رندر جدولی، با در نظر گرفتن Expand/Collapse و فیلترها.
 * خالص و قابل‌تست.
 */
import { collectDescendantIds, countDescendants, type ControlTreeNode } from './build-wbs-tree';
import type { WbsNodeComputedDto } from '../api/project-control-types';

export interface FlatRow {
  node: WbsNodeComputedDto;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  descendantCount: number;
  isExpanded: boolean;
}

export interface FlattenOptions {
  expanded: ReadonlySet<string>;
  /** تابع تطبیق فیلتر؛ اگر undefined باشد همهٔ نودها مطابق‌اند. */
  match?: (node: WbsNodeComputedDto) => boolean;
}

/**
 * مجموعهٔ نودهای «قابل‌نمایش» بر اساس فیلتر:
 * نودی که خودش تطبیق دارد + تمام نیاکانش (برای حفظ زمینه).
 */
function computeVisibleSet(
  roots: ControlTreeNode[],
  match: (node: WbsNodeComputedDto) => boolean,
): Set<string> {
  const visible = new Set<string>();
  const walk = (item: ControlTreeNode, ancestors: string[]): void => {
    if (match(item.node)) {
      visible.add(item.node.id);
      for (const a of ancestors) visible.add(a);
    }
    for (const child of item.children) {
      walk(child, [...ancestors, item.node.id]);
    }
  };
  for (const root of roots) walk(root, []);
  return visible;
}

export function flattenVisibleTree(
  roots: ControlTreeNode[],
  { expanded, match }: FlattenOptions,
): FlatRow[] {
  const filterActive = Boolean(match);
  const visibleSet = match ? computeVisibleSet(roots, match) : null;
  const rows: FlatRow[] = [];

  const walk = (item: ControlTreeNode): void => {
    if (visibleSet && !visibleSet.has(item.node.id)) return;
    const hasChildren = item.children.length > 0;
    // هنگام فیلتر فعال، مسیر تا تطبیق باز می‌ماند؛ در غیر این صورت از expanded پیروی می‌کنیم.
    const isExpanded = filterActive ? true : expanded.has(item.node.id);
    rows.push({
      node: item.node,
      depth: item.depth,
      hasChildren,
      childCount: item.children.length,
      descendantCount: countDescendants(item),
      isExpanded,
    });
    if (hasChildren && isExpanded) {
      for (const child of item.children) walk(child);
    }
  };

  for (const root of roots) walk(root);
  return rows;
}

/** جمع‌آوری تمام شناسه‌های نودهای دارای فرزند (برای Expand All). */
export function collectExpandableIds(roots: ControlTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (item: ControlTreeNode): void => {
    if (item.children.length > 0) {
      ids.add(item.node.id);
      for (const child of item.children) walk(child);
    }
  };
  for (const root of roots) walk(root);
  return ids;
}

/** مجموعهٔ شناسه‌های نیاکان یک نود (برای باز کردن مسیر تا آن). */
export function ancestorIdsOf(roots: ControlTreeNode[], nodeId: string): Set<string> {
  const result = new Set<string>();
  const walk = (item: ControlTreeNode, ancestors: string[]): boolean => {
    if (item.node.id === nodeId) {
      for (const a of ancestors) result.add(a);
      return true;
    }
    for (const child of item.children) {
      if (walk(child, [...ancestors, item.node.id])) return true;
    }
    return false;
  };
  for (const root of roots) walk(root, []);
  return result;
}

export { collectDescendantIds };
