'use client';

import { DashboardRouter } from '@/features/project-control/components/dashboard/dashboard-router';

export default function ProjectDashboardPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  return <DashboardRouter projectId={params.projectId} />;
}
