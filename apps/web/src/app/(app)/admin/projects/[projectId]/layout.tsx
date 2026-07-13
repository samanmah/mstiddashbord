'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProjectTabs } from '@/components/admin/project-tabs';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';

export default function ProjectAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const { data: project } = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectService.get(projectId),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/admin/projects" className="text-sm text-brand-blue hover:underline">
            ← بازگشت به فهرست پروژه‌ها
          </Link>
          <h1 className="mt-1 text-lg font-bold text-navy-900">
            {project?.titleFa ?? 'مدیریت پروژه'}
          </h1>
        </div>
      </div>
      <ProjectTabs projectId={projectId} />
      {children}
    </div>
  );
}
