'use client';

import { ControlOverview } from '@/features/project-control/components/editor/control-overview';

export default function ControlOverviewPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  return <ControlOverview projectId={params.projectId} />;
}
