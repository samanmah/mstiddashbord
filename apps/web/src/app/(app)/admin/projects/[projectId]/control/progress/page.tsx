'use client';

import { ProgressWorkspace } from '@/features/project-control/components/editor/progress-workspace';
import { useAuth } from '@/hooks/use-auth';

export default function ControlProgressPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { isEditor } = useAuth();
  return <ProgressWorkspace projectId={params.projectId} isEditor={isEditor} />;
}
