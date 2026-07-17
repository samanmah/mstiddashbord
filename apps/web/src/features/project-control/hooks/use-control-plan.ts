'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';
import type { EnableControlInput } from '../api/project-control-types';

/** برنامهٔ کنترل فعال پروژه (یا null اگر Project Control غیرفعال باشد). */
export function useControlPlan(projectId: string) {
  return useQuery({
    queryKey: controlKeys.plan(projectId),
    queryFn: () => projectControlApi.getPlan(projectId),
    staleTime: 60_000,
  });
}

/** فعال‌سازی کنترل پروژه؛ پس از موفقیت plan و wbs بازخوانی می‌شوند. */
export function useEnableControl(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EnableControlInput) => projectControlApi.enable(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: controlKeys.plan(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.wbs(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.dashboard(projectId) });
    },
  });
}
