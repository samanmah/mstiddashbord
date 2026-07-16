/**
 * نگاشت‌های Semantic وضعیت/شاخص به Tone طراحی (پایه: StatusBadge موجود).
 * توابع خالص و قابل‌تست هستند.
 */
import type { LabelColor } from '@ppm/contracts';
import {
  CONTROL_NODE_STATUS_LABELS,
  type ControlNodeStatus,
  type DataQualityReport,
} from '../api/project-control-types';

type Tone = LabelColor['tone'];

const STATUS_TONE: Record<ControlNodeStatus, Tone> = {
  ON_TRACK: 'green',
  COMPLETED: 'green',
  AT_RISK: 'orange',
  DELAYED: 'red',
  BLOCKED: 'red',
  NOT_STARTED: 'gray',
  CANCELLED: 'gray',
  UNKNOWN: 'gray',
};

/** Tone وضعیت نود. */
export function statusTone(status: ControlNodeStatus | null | undefined): Tone {
  if (!status) return 'gray';
  return STATUS_TONE[status] ?? 'gray';
}

/** برچسب فارسی وضعیت. */
export function statusLabel(status: ControlNodeStatus | null | undefined): string {
  if (!status) return CONTROL_NODE_STATUS_LABELS.UNKNOWN;
  return CONTROL_NODE_STATUS_LABELS[status] ?? CONTROL_NODE_STATUS_LABELS.UNKNOWN;
}

/** Tone انحراف زمان‌بندی: منفی = قرمز، نزدیک صفر = سبز. */
export function varianceTone(value: number | null | undefined): Tone {
  if (value == null || Number.isNaN(value)) return 'gray';
  if (value <= -15) return 'red';
  if (value < -5) return 'orange';
  return 'green';
}

/** Tone شاخص SPI/CPI (۱ مبنا). */
export function indexTone(value: number | null | undefined): Tone {
  if (value == null || Number.isNaN(value)) return 'gray';
  if (value < 0.85) return 'red';
  if (value < 0.95) return 'orange';
  return 'green';
}

/** مجموع مسائل کیفیت داده. */
export function dataQualityIssueCount(report: DataQualityReport | null | undefined): number {
  if (!report) return 0;
  return (
    report.nodesWithoutDates +
    report.nodesWithoutWeight +
    report.nodesWithoutOwner +
    report.nodesWithoutDod +
    report.invalidDependencies +
    report.unbalancedWeightParents +
    report.fileConflicts +
    report.staleData
  );
}

/** Tone نشان کیفیت داده بر اساس تعداد مسائل. */
export function dataQualityTone(count: number): Tone {
  if (count === 0) return 'green';
  if (count <= 10) return 'orange';
  return 'purple';
}
