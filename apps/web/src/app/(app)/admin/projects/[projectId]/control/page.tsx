import { redirect } from 'next/navigation';

export default function ControlIndexPage({
  params,
}: {
  params: { projectId: string };
}): never {
  redirect(`/admin/projects/${params.projectId}/control/overview`);
}
