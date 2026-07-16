'use client';

import { useQuery } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';

/** داده‌های Gantt (نودها + مقادیر محاسبه‌شده). */
export function useControlGantt(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.gantt(projectId),
    queryFn: () => projectControlApi.getGantt(projectId),
    enabled,
  });
}
