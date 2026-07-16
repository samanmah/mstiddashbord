'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';
import type { BaselineInput } from '../api/project-control-types';

export function useBaselines(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.baselines(projectId),
    queryFn: () => projectControlApi.listBaselines(projectId),
    enabled,
  });
}

export function useBaselineCompare(projectId: string, id: string | null) {
  return useQuery({
    queryKey: controlKeys.baselineCompare(projectId, id ?? '—'),
    queryFn: () => projectControlApi.compareBaseline(projectId, id as string),
    enabled: Boolean(id),
  });
}

export function useCreateBaseline(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BaselineInput) => projectControlApi.createBaseline(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: controlKeys.baselines(projectId) });
    },
  });
}

export function useActivateBaseline(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectControlApi.activateBaseline(projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: controlKeys.baselines(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.plan(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.dashboard(projectId) });
    },
  });
}
