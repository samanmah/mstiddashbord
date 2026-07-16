import { describe, expect, it } from 'vitest';
import { buildWbsTree, collectDescendantIds, countDescendants, wouldCreateCycle } from './build-wbs-tree';
import { makeNode } from './wbs-fixtures';

describe('buildWbsTree', () => {
  const nodes = [
    makeNode({ id: 'root', parentId: null, depth: 0, sortOrder: 0 }),
    makeNode({ id: 'a', parentId: 'root', depth: 1, sortOrder: 1 }),
    makeNode({ id: 'b', parentId: 'root', depth: 1, sortOrder: 0 }),
    makeNode({ id: 'a1', parentId: 'a', depth: 2, sortOrder: 0 }),
  ];

  it('builds a single root with nested children', () => {
    const tree = buildWbsTree(nodes);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.node.id).toBe('root');
    expect(tree[0]!.children).toHaveLength(2);
  });

  it('sorts children by sortOrder', () => {
    const tree = buildWbsTree(nodes);
    expect(tree[0]!.children.map((c) => c.node.id)).toEqual(['b', 'a']);
  });

  it('assigns depth by tree level regardless of input order', () => {
    const tree = buildWbsTree(nodes);
    const a = tree[0]!.children.find((c) => c.node.id === 'a')!;
    expect(a.depth).toBe(1);
    expect(a.children[0]!.depth).toBe(2);
  });

  it('treats nodes with missing parents as roots', () => {
    const orphan = [makeNode({ id: 'x', parentId: 'ghost' })];
    const tree = buildWbsTree(orphan);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.node.id).toBe('x');
  });

  it('countDescendants and collectDescendantIds work', () => {
    const tree = buildWbsTree(nodes);
    expect(countDescendants(tree[0]!)).toBe(3);
    const ids = collectDescendantIds(tree[0]!);
    expect([...ids].sort()).toEqual(['a', 'a1', 'b']);
  });
});

describe('wouldCreateCycle', () => {
  const nodes = [
    makeNode({ id: 'root', parentId: null }),
    makeNode({ id: 'a', parentId: 'root' }),
    makeNode({ id: 'a1', parentId: 'a' }),
  ];

  it('detects moving a node under itself', () => {
    expect(wouldCreateCycle(nodes, 'a', 'a')).toBe(true);
  });

  it('detects moving a node under its own descendant', () => {
    expect(wouldCreateCycle(nodes, 'a', 'a1')).toBe(true);
  });

  it('allows a valid reparent', () => {
    expect(wouldCreateCycle(nodes, 'a1', 'root')).toBe(false);
  });

  it('allows moving to root (null parent)', () => {
    expect(wouldCreateCycle(nodes, 'a', null)).toBe(false);
  });
});
