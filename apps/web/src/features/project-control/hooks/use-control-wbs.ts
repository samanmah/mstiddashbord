'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';
import type { ReorderInput, ReparentInput, WbsNodeInput } from '../api/project-control-types';

/** فهرست تخت نودهای WBS با مقادیر محاسبه‌شده. */
export function useWbsList(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.wbs(projectId),
    queryFn: () => projectControlApi.listWbs(projectId),
    enabled,
  });
}

/** پس از تغییر ساختار/داده WBS، Queryهای وابسته را Invalidate می‌کند. */
function useWbsInvalidation(projectId: string): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: controlKeys.wbs(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.dashboard(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.gantt(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.dataQuality(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.phaseRollup(projectId) });
  };
}

export function useCreateNode(projectId: string) {
  const invalidate = useWbsInvalidation(projectId);
  return useMutation({
    mutationFn: (body: WbsNodeInput) => projectControlApi.createNode(projectId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateNode(projectId: string) {
  const invalidate = useWbsInvalidation(projectId);
  return useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: WbsNodeInput }) =>
      projectControlApi.updateNode(projectId, nodeId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteNode(projectId: string) {
  const invalidate = useWbsInvalidation(projectId);
  return useMutation({
    mutationFn: (nodeId: string) => projectControlApi.deleteNode(projectId, nodeId),
    onSuccess: invalidate,
  });
}

export function useReparentNode(projectId: string) {
  const invalidate = useWbsInvalidation(projectId);
  return useMutation({
    mutationFn: (body: ReparentInput) => projectControlApi.reparent(projectId, body),
    onSuccess: invalidate,
  });
}

export function useReorderNodes(projectId: string) {
  const invalidate = useWbsInvalidation(projectId);
  return useMutation({
    mutationFn: (body: ReorderInput) => projectControlApi.reorder(projectId, body),
    onSuccess: invalidate,
  });
}
