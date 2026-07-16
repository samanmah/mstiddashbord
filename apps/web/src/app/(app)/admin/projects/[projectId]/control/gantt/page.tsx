'use client';

import { GanttChart } from '@/features/project-control/components/gantt/gantt-chart';

export default function ControlGanttPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  return <GanttChart projectId={params.projectId} mode="editor" />;
}
