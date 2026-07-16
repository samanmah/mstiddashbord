'use client';

import { GanttChart } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';

export default function ControlGanttPage(): React.JSX.Element {
  return (
    <EmptyState
      icon={<GanttChart className="h-8 w-8" aria-hidden />}
      title="گانت تعاملی"
      description="نمای گانت پیشرفته در Checkpoint بعدی (داشبورد و گانت) اضافه می‌شود."
    />
  );
}
