'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';

export function ProjectSelector({ currentId }: { currentId: string }): React.JSX.Element | null {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectService.list,
  });

  if (!data || data.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-sm text-grayx-header">انتخاب پروژه:</span>
      <Select
        className="w-64"
        value={currentId}
        onChange={(e) => router.push(`/dashboard/projects/${e.target.value}`)}
        options={data.map((p) => ({ value: p.id, label: p.titleFa }))}
      />
    </div>
  );
}
