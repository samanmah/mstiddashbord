'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { isApiError } from '@/lib/api-error';
import type { WbsNodeComputedDto, WbsNodeInput } from '../../api/project-control-types';
import { useUpdateNode } from '../../hooks/use-control-wbs';

type EditableField = 'title' | 'weight' | 'percentComplete';

/** سلول ویرایش درجا: Enter=ذخیره، Escape=انصراف. با نسخه (Optimistic Concurrency). */
export function InlineEditCell({
  projectId,
  node,
  field,
  display,
  onConflict,
}: {
  projectId: string;
  node: WbsNodeComputedDto;
  field: EditableField;
  display: string;
  onConflict: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const update = useUpdateNode(projectId);

  const start = (): void => {
    const initial =
      field === 'title'
        ? node.title
        : field === 'weight'
          ? node.weight == null
            ? ''
            : String(node.weight)
          : node.percentComplete == null
            ? ''
            : String(node.percentComplete);
    setValue(initial);
    setEditing(true);
  };

  const commit = (): void => {
    const body: WbsNodeInput = { version: node.version };
    if (field === 'title') {
      if (!value.trim()) {
        toast.error('عنوان نمی‌تواند خالی باشد');
        return;
      }
      body.title = value.trim();
    } else {
      const n = value.trim() === '' ? null : Number(value);
      if (n != null && (Number.isNaN(n) || n < 0 || n > 100)) {
        toast.error('مقدار باید بین ۰ تا ۱۰۰ باشد');
        return;
      }
      if (field === 'weight') body.weight = n;
      else body.percentComplete = n;
    }
    update.mutate(
      { nodeId: node.id, body },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => {
          if (isApiError(e) && e.isConflict) {
            setEditing(false);
            onConflict();
            return;
          }
          toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود');
        },
      },
    );
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          className="input h-7 w-full px-1 py-0 text-xs"
          type={field === 'title' ? 'text' : 'number'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => setEditing(false)}
        />
        {update.isPending ? <Loader2 className="h-3 w-3 animate-spin text-navy-700" aria-hidden /> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="w-full truncate rounded px-1 text-right hover:bg-page"
      onDoubleClick={start}
      title="برای ویرایش دوبار کلیک کنید"
    >
      {display}
    </button>
  );
}
