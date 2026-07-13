'use client';

import { DashboardView } from '@/components/dashboard/dashboard-view';

export default function ProjectDashboardPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  return <DashboardView projectId={params.projectId} />;
}
