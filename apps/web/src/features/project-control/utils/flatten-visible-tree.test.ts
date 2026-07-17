import { describe, expect, it } from 'vitest';
import { buildWbsTree } from './build-wbs-tree';
import {
  ancestorIdsOf,
  collectExpandableIds,
  flattenVisibleTree,
} from './flatten-visible-tree';
import { makeNode } from './wbs-fixtures';

const nodes = [
  makeNode({ id: 'root', parentId: null, title: 'ریشه' }),
  makeNode({ id: 'a', parentId: 'root', title: 'فاز الف' }),
  makeNode({ id: 'a1', parentId: 'a', title: 'کار یک' }),
  makeNode({ id: 'b', parentId: 'root', title: 'فاز ب', sortOrder: 1 }),
];
const tree = buildWbsTree(nodes);

describe('flattenVisibleTree', () => {
  it('shows only expanded branches', () => {
    const rows = flattenVisibleTree(tree, { expanded: new Set(['root']) });
    expect(rows.map((r) => r.node.id)).toEqual(['root', 'a', 'b']);
  });

  it('hides children when parent collapsed', () => {
    const rows = flattenVisibleTree(tree, { expanded: new Set() });
    expect(rows.map((r) => r.node.id)).toEqual(['root']);
  });

  it('expands full path when a filter matches a deep node', () => {
    const rows = flattenVisibleTree(tree, {
      expanded: new Set(),
      match: (n) => n.title.includes('کار یک'),
    });
    expect(rows.map((r) => r.node.id)).toEqual(['root', 'a', 'a1']);
  });

  it('marks hasChildren and descendantCount correctly', () => {
    const rows = flattenVisibleTree(tree, { expanded: new Set(['root', 'a']) });
    const root = rows.find((r) => r.node.id === 'root')!;
    expect(root.hasChildren).toBe(true);
    expect(root.descendantCount).toBe(3);
    const a1 = rows.find((r) => r.node.id === 'a1')!;
    expect(a1.hasChildren).toBe(false);
  });
});

describe('collectExpandableIds', () => {
  it('returns ids of nodes with children', () => {
    const ids = collectExpandableIds(tree);
    expect([...ids].sort()).toEqual(['a', 'root']);
  });
});

describe('ancestorIdsOf', () => {
  it('returns ancestors of a node', () => {
    const ids = ancestorIdsOf(tree, 'a1');
    expect([...ids].sort()).toEqual(['a', 'root']);
  });
});
