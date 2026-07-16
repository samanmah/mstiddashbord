'use client';

import { DependenciesEditor } from '@/features/project-control/components/editor/dependencies-editor';
import { useAuth } from '@/hooks/use-auth';

export default function ControlDependenciesPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { isEditor } = useAuth();
  return <DependenciesEditor projectId={params.projectId} isEditor={isEditor} />;
}
