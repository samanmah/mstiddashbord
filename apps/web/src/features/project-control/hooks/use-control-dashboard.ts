'use client';

import { useQuery } from '@tanstack/react-query';
import { projectControlApi } from '../api/project-control-api';
import { controlKeys } from '../api/project-control-query-keys';

/** داشبورد مدیریتی یکپارچه (Aggregated). */
export function useControlDashboard(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.dashboard(projectId),
    queryFn: () => projectControlApi.getDashboard(projectId),
    enabled,
  });
}

export function usePhaseRollup(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.phaseRollup(projectId),
    queryFn: () => projectControlApi.getPhaseRollup(projectId),
    enabled,
  });
}

export function useSCurve(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.sCurve(projectId),
    queryFn: () => projectControlApi.getSCurve(projectId),
    enabled,
  });
}

export function useCriticalPath(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.criticalPath(projectId),
    queryFn: () => projectControlApi.getCriticalPath(projectId),
    enabled,
  });
}

export function useDataQuality(projectId: string, enabled = true) {
  return useQuery({
    queryKey: controlKeys.dataQuality(projectId),
    queryFn: () => projectControlApi.getDataQuality(projectId),
    enabled,
  });
}
