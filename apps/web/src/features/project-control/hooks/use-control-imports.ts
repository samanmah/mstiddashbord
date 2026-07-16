'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';
import type { ImportMappingItem } from '../api/project-control-types';

export function useImports(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.imports(projectId),
    queryFn: () => projectControlApi.listImports(projectId),
    enabled,
  });
}

/** بررسی محیط MPP (Java/MPXJ). به‌صورت دستی فراخوانی می‌شود تا UI هرگز Crash نکند. */
export function useMppCheck(projectId: string) {
  return useQuery({
    queryKey: controlKeys.mppCheck(projectId),
    queryFn: () => projectControlApi.mppCheck(projectId),
    enabled: false,
    retry: false,
    staleTime: 30_000,
  });
}

export function useUploadImport(projectId: string) {
  return useMutation({
    mutationFn: ({ file, sourceType }: { file: File; sourceType?: 'EXCEL' | 'MPP' }) =>
      projectControlApi.uploadImport(projectId, file, sourceType),
  });
}

export function usePreviewImport(projectId: string) {
  return useMutation({
    mutationFn: ({ id, dryRun = true }: { id: string; dryRun?: boolean }) =>
      projectControlApi.previewImport(projectId, id, dryRun),
  });
}

export function useMapImport(projectId: string) {
  return useMutation({
    mutationFn: ({ id, mappings }: { id: string; mappings: ImportMappingItem[] }) =>
      projectControlApi.mapImport(projectId, id, mappings),
  });
}

export function useValidateImport(projectId: string) {
  return useMutation({
    mutationFn: (id: string) => projectControlApi.validateImport(projectId, id),
  });
}

export function useCommitImport(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allowWarnings = false }: { id: string; allowWarnings?: boolean }) =>
      projectControlApi.commitImport(projectId, id, allowWarnings),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: controlKeys.wbs(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.dashboard(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.gantt(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.imports(projectId) });
      void qc.invalidateQueries({ queryKey: controlKeys.dataQuality(projectId) });
    },
  });
}
