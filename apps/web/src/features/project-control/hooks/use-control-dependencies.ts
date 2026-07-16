'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';
import type { DependencyInput, DependencyUpdateInput } from '../api/project-control-types';

export function useDependencies(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.dependencies(projectId),
    queryFn: () => projectControlApi.listDependencies(projectId),
    enabled,
  });
}

function useDependencyInvalidation(projectId: string): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: controlKeys.dependencies(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.gantt(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.dataQuality(projectId) });
    void qc.invalidateQueries({ queryKey: controlKeys.wbs(projectId) });
  };
}

export function useCreateDependency(projectId: string) {
  const invalidate = useDependencyInvalidation(projectId);
  return useMutation({
    mutationFn: (body: DependencyInput) => projectControlApi.createDependency(projectId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateDependency(projectId: string) {
  const invalidate = useDependencyInvalidation(projectId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DependencyUpdateInput }) =>
      projectControlApi.updateDependency(projectId, id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteDependency(projectId: string) {
  const invalidate = useDependencyInvalidation(projectId);
  return useMutation({
    mutationFn: (id: string) => projectControlApi.deleteDependency(projectId, id),
    onSuccess: invalidate,
  });
}
