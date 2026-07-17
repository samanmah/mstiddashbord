/**
 * ساخت درخت WBS از فهرست تخت (خروجی Backend). خالص و قابل‌تست.
 */
import type { WbsNodeComputedDto } from '../api/project-control-types';

export interface ControlTreeNode {
  node: WbsNodeComputedDto;
  children: ControlTreeNode[];
  depth: number;
}

/**
 * فهرست تخت نودها را به درخت تبدیل می‌کند.
 * ریشه‌ها نودهایی هستند که parentId ندارند یا والدشان در مجموعه نیست.
 * ترتیب فرزندان بر اساس sortOrder سپس عنوان.
 */
export function buildWbsTree(nodes: WbsNodeComputedDto[]): ControlTreeNode[] {
  const byId = new Map<string, ControlTreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { node, children: [], depth: 0 });
  }

  const roots: ControlTreeNode[] = [];
  for (const entry of byId.values()) {
    const parentId = entry.node.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) {
      parent.children.push(entry);
    } else {
      roots.push(entry);
    }
  }

  const sortFn = (a: ControlTreeNode, b: ControlTreeNode): number => {
    if (a.node.sortOrder !== b.node.sortOrder) return a.node.sortOrder - b.node.sortOrder;
    return a.node.title.localeCompare(b.node.title, 'fa');
  };

  const assignDepth = (list: ControlTreeNode[], depth: number): void => {
    list.sort(sortFn);
    for (const item of list) {
      item.depth = depth;
      assignDepth(item.children, depth + 1);
    }
  };
  assignDepth(roots, 0);

  return roots;
}

/** شمارش کل نوادگان یک نود. */
export function countDescendants(node: ControlTreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

/** بازگرداندن شناسهٔ تمام نوادگان یک نود (شامل خودش اختیاری). */
export function collectDescendantIds(node: ControlTreeNode, includeSelf = false): Set<string> {
  const ids = new Set<string>();
  if (includeSelf) ids.add(node.node.id);
  const walk = (n: ControlTreeNode): void => {
    for (const child of n.children) {
      ids.add(child.node.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
}

/**
 * بررسی چرخهٔ سلسله‌مراتب سمت Client قبل از Reparent:
 * اگر newParentId خودِ نود یا یکی از نوادگانش باشد، چرخه ایجاد می‌شود.
 */
export function wouldCreateCycle(
  nodes: WbsNodeComputedDto[],
  nodeId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === nodeId) return true;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current: string | null | undefined = newParentId;
  const guard = new Set<string>();
  while (current) {
    if (current === nodeId) return true;
    if (guard.has(current)) return true; // چرخهٔ ازپیش‌موجود
    guard.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}
