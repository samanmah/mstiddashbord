'use client';

import { DataQualityPanel } from '@/features/project-control/components/editor/data-quality-panel';

export default function ControlDataQualityPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  return <DataQualityPanel projectId={params.projectId} />;
}
