'use client';

import { WbsEditor } from '@/features/project-control/components/editor/wbs-editor';
import { useAuth } from '@/hooks/use-auth';

export default function ControlWbsPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { isEditor } = useAuth();
  return <WbsEditor projectId={params.projectId} isEditor={isEditor} />;
}
