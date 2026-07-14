import type { ProjectDto } from '@ppm/contracts';
import { FolderKanban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { isoToJalaliFa, orDash } from '@/lib/utils';

export function ProjectInfoCard({ project }: { project: ProjectDto }): React.JSX.Element {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="section-icon bg-accent-blue/15 text-accent-blue">
            <FolderKanban className="h-[18px] w-[18px]" aria-hidden />
          </span>
          اطلاعات پروژه
        </span>
      }
      headerTone="navy"
      className="border-t-2 border-t-accent-blue"
      bodyClassName="space-y-2.5 text-sm"
    >
      <InfoRow label="شرح پروژه" value={orDash(project.description)} multiline />
      <InfoRow label="نوع پروژه" value={orDash(project.projectType)} />
      <InfoRow label="تاریخ شروع" value={isoToJalaliFa(project.startDate)} />
      <InfoRow label="تاریخ پایان برنامه‌ای" value={isoToJalaliFa(project.plannedEndDate)} />
      <InfoRow label="آخرین به‌روزرسانی" value={isoToJalaliFa(project.reportDate)} />
    </Card>
  );
}

function InfoRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={
        multiline
          ? 'flex flex-col gap-1 border-b border-borderx/60 pb-2'
          : 'flex items-center justify-between gap-2 border-b border-borderx/60 pb-2 last:border-0'
      }
    >
      <span className="shrink-0 text-grayx-header">{label}:</span>
      <span className={multiline ? 'leading-6 text-ink' : 'text-left font-semibold text-ink'}>
        {value}
      </span>
    </div>
  );
}
