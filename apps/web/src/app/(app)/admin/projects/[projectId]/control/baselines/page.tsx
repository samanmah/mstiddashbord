'use client';

import { BaselinesEditor } from '@/features/project-control/components/editor/baselines-editor';
import { useAuth } from '@/hooks/use-auth';

export default function ControlBaselinesPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { isEditor } = useAuth();
  return <BaselinesEditor projectId={params.projectId} isEditor={isEditor} />;
}
