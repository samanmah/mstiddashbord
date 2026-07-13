import type {
  ActivityStatus,
  DecisionStatus,
  Probability,
  RiskLevel,
  UserRole,
} from './enums';

/** برچسب و رنگ فارسی برای Enumها جهت نمایش در UI. */

export interface LabelColor {
  label: string;
  /** توکن رنگ (مطابق متغیرهای CSS پروژه) */
  color: string;
  /** کلاس رنگ متن/نقطه برای Badge */
  tone: 'green' | 'orange' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray';
}

export const ACTIVITY_STATUS_META: Record<ActivityStatus, LabelColor> = {
  GOOD: { label: 'خوب', color: '#20A55A', tone: 'green' },
  AVERAGE: { label: 'متوسط', color: '#F57C00', tone: 'orange' },
  WEAK: { label: 'ضعیف', color: '#E53935', tone: 'red' },
  UNKNOWN: { label: 'نامشخص', color: '#9AA6B2', tone: 'gray' },
};

export const RISK_LEVEL_META: Record<RiskLevel, LabelColor> = {
  HIGH: { label: 'بالا', color: '#E53935', tone: 'red' },
  MEDIUM: { label: 'متوسط', color: '#F57C00', tone: 'orange' },
  LOW: { label: 'پایین', color: '#FFD400', tone: 'yellow' },
};

export const PROBABILITY_META: Record<Probability, LabelColor> = {
  HIGH: { label: 'بالا', color: '#E53935', tone: 'red' },
  MEDIUM: { label: 'متوسط', color: '#F57C00', tone: 'orange' },
  LOW: { label: 'پایین', color: '#FFD400', tone: 'yellow' },
};

export const DECISION_STATUS_META: Record<DecisionStatus, LabelColor> = {
  NEW: { label: 'جدید', color: '#2D9CDB', tone: 'blue' },
  IN_PROGRESS: { label: 'در حال اجرا', color: '#F57C00', tone: 'orange' },
  WAITING_FOR_REPORT: { label: 'در انتظار گزارش', color: '#8E5BD9', tone: 'purple' },
  DONE: { label: 'انجام شد', color: '#20A55A', tone: 'green' },
  OTHER: { label: 'سایر', color: '#9AA6B2', tone: 'gray' },
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  MANAGER_VIEWER: 'مدیر (فقط مشاهده)',
  PROJECT_EDITOR: 'ویرایشگر پروژه',
};

/** مقدار جایگزین برای فیلدهای خالی در UI. */
export const EMPTY_PLACEHOLDER = '—';
