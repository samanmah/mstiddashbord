'use client';

import { ImportWizard } from '@/features/project-control/components/import/import-wizard';
import { useAuth } from '@/hooks/use-auth';

export default function ControlImportsPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { isEditor } = useAuth();
  if (!isEditor) {
    return (
      <div className="card p-6 text-center text-sm text-grayx-header">
        ورود اطلاعات فقط برای ویرایشگر پروژه در دسترس است.
      </div>
    );
  }
  return <ImportWizard projectId={params.projectId} />;
}
