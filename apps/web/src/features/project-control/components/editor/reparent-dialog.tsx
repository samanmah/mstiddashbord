'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { isApiError } from '@/lib/api-error';
import type { WbsNodeComputedDto } from '../../api/project-control-types';
import { useReparentNode } from '../../hooks/use-control-wbs';
import { buildWbsTree, collectDescendantIds, wouldCreateCycle } from '../../utils/build-wbs-tree';

export function ReparentDialog({
  projectId,
  node,
  allNodes,
  onClose,
}: {
  projectId: string;
  node: WbsNodeComputedDto;
  allNodes: WbsNodeComputedDto[];
  onClose: () => void;
}): React.JSX.Element {
  const reparent = useReparentNode(projectId);
  const [target, setTarget] = useState<string>(node.parentId ?? '');

  // نودهای غیرمجاز به‌عنوان والد: خودِ نود و تمام نوادگانش.
  const forbidden = useMemo(() => {
    const tree = buildWbsTree(allNodes);
    const findNode = (): ReturnType<typeof buildWbsTree>[number] | null => {
      let found: ReturnType<typeof buildWbsTree>[number] | null = null;
      const walk = (items: ReturnType<typeof buildWbsTree>): void => {
        for (const it of items) {
          if (it.node.id === node.id) found = it;
          else walk(it.children);
        }
      };
      walk(tree);
      return found;
    };
    const self = findNode();
    const ids = self ? collectDescendantIds(self, true) : new Set<string>([node.id]);
    return ids;
  }, [allNodes, node.id]);

  const options = useMemo(
    () => [
      { value: '', label: 'ریشه (بدون والد)' },
      ...allNodes
        .filter((n) => !forbidden.has(n.id))
        .map((n) => ({ value: n.id, label: `${n.code ? `${n.code} — ` : ''}${n.title}` })),
    ],
    [allNodes, forbidden],
  );

  const submit = (): void => {
    const newParentId = target === '' ? null : target;
    if (wouldCreateCycle(allNodes, node.id, newParentId)) {
      toast.error('انتقال باعث ایجاد چرخه در ساختار می‌شود');
      return;
    }
    reparent.mutate(
      { nodeId: node.id, newParentId },
      {
        onSuccess: () => {
          toast.success('والد نود تغییر کرد');
          onClose();
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'تغییر والد ناموفق بود'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`تغییر والد: ${node.title}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={reparent.isPending}>
            انتقال
          </Button>
        </>
      }
    >
      <Field label="والد جدید">
        <Select options={options} value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>
      <p className="mt-2 text-xs text-grayx-header">
        نودِ جاری و نوادگانش در فهرست نمایش داده نمی‌شوند تا از ایجاد چرخه جلوگیری شود. اعتبارسنجی
        نهایی در سرور نیز انجام می‌شود.
      </p>
    </Modal>
  );
}
