'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageSpinner } from '@/components/ui/spinner';

export default function ProjectAdminIndex({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/projects/${params.projectId}/general`);
  }, [router, params.projectId]);
  return <FullPageSpinner />;
}
