'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const chartFallback = <Skeleton className="h-[240px] w-full" />;

export const LazyMonthlyLineChart = dynamic(
  () => import('./monthly-line-chart').then((m) => m.MonthlyLineChart),
  { ssr: false, loading: () => chartFallback },
);

export const LazyActivityBarChart = dynamic(
  () => import('./activity-bar-chart').then((m) => m.ActivityBarChart),
  { ssr: false, loading: () => chartFallback },
);

export const LazyActivityTimeline = dynamic(
  () => import('./activity-timeline').then((m) => m.ActivityTimeline),
  { ssr: false, loading: () => chartFallback },
);
