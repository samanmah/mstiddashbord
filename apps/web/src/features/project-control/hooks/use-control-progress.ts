'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';
import type { ProgressInput } from '../api/project-control-types';

export function useProgressList(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.progress(projectId),
    queryFn: () => projectControlApi.listProgress(projectId),
    enabled,
  });
}

export function useProgressHistory(projectId: string, nodeId: string | null) {
  return useQuery({
    queryKey: controlKeys.progressHistory(projectId, nodeId ?? '—'),
    queryFn: () => projectControlApi.progressHistory(projectId, nodeId as string),
    enabled: Boolean(nodeId),
  });
}

/** ثبت پیشرفت، Dashboard/WBS/Analytics را به‌روزرسانی می‌کند. */
function useProgressInvalidation(projectId: string): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: controlKeys.progress(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.wbs(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.dashboard(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.gantt(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.sCurve(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.phaseRollup(projectId) });
  };
}

export function useCreateProgress(projectId: string) {
  const invalidate = useProgressInvalidation(projectId);
  return useMutation({
    mutationFn: (body: ProgressInput) => projectControlApi.createProgress(projectId, body),
    onSuccess: invalidate,
  });
}

export function useBulkProgress(projectId: string) {
  const invalidate = useProgressInvalidation(projectId);
  return useMutation({
    mutationFn: (items: ProgressInput[]) => projectControlApi.bulkProgress(projectId, items),
    onSuccess: invalidate,
  });
}
