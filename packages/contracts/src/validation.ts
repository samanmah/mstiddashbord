import { z } from 'zod';
import {
  ActivityStatus,
  DecisionStatus,
  Probability,
  RiskLevel,
  UserRole,
} from './enums';
import { isValidJalaliDate } from './jalali';
import { toLatinDigits } from './normalize';

/** ثابت‌های مشترک اعتبارسنجی. */
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 12,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 64,
  TITLE_MAX_LENGTH: 500,
  DESCRIPTION_MAX_LENGTH: 4000,
  UPLOAD_MAX_BYTES: 20 * 1024 * 1024,
  WEIGHT_SUM_TOLERANCE: 0.001,
  CONSISTENCY_THRESHOLD: 0.5,
} as const;

/** الگوی رمز عبور قوی: ۱۲+ کاراکتر، حرف بزرگ/کوچک/عدد/نماد. */
export const strongPasswordSchema = z
  .string()
  .min(VALIDATION.PASSWORD_MIN_LENGTH, {
    message: `رمز عبور باید حداقل ${VALIDATION.PASSWORD_MIN_LENGTH} کاراکتر باشد.`,
  })
  .refine((v) => /[A-Z]/.test(v), { message: 'رمز عبور باید حرف بزرگ داشته باشد.' })
  .refine((v) => /[a-z]/.test(v), { message: 'رمز عبور باید حرف کوچک داشته باشد.' })
  .refine((v) => /[0-9]/.test(v), { message: 'رمز عبور باید عدد داشته باشد.' })
  .refine((v) => /[^A-Za-z0-9]/.test(v), {
    message: 'رمز عبور باید علامت ویژه داشته باشد.',
  });

/** تاریخ جلالی به‌شکل رشته YYYY/MM/DD. */
export const jalaliDateSchema = z
  .string()
  .min(1, { message: 'تاریخ الزامی است.' })
  .refine(
    (v) => {
      const parts = toLatinDigits(v.trim()).replace(/-/g, '/').split('/');
      if (parts.length !== 3) return false;
      return isValidJalaliDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
    },
    { message: 'تاریخ جلالی نامعتبر است. قالب صحیح: ۱۴۰۵/۰۴/۰۱' },
  );

export const optionalJalaliDateSchema = z
  .union([jalaliDateSchema, z.literal(''), z.null()])
  .transform((v) => (v === '' ? null : v))
  .nullable();

export const loginSchema = z.object({
  username: z.string().min(1, { message: 'نام کاربری الزامی است.' }),
  password: z.string().min(1, { message: 'رمز عبور الزامی است.' }),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'رمز فعلی الزامی است.' }),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, { message: 'تکرار رمز الزامی است.' }),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'رمز جدید و تکرار آن یکسان نیستند.',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const percentField = z
  .number({ invalid_type_error: 'مقدار باید عدد باشد.' })
  .min(0, { message: 'مقدار نمی‌تواند منفی باشد.' })
  .max(100, { message: 'مقدار نمی‌تواند بیشتر از ۱۰۰ باشد.' });

export const projectFormSchema = z
  .object({
    titleFa: z
      .string()
      .min(1, { message: 'عنوان فارسی الزامی است.' })
      .max(VALIDATION.TITLE_MAX_LENGTH),
    titleEn: z.string().max(VALIDATION.TITLE_MAX_LENGTH).nullable().optional(),
    projectCode: z.string().max(100).nullable().optional(),
    projectManager: z.string().min(1, { message: 'مسئول پروژه الزامی است.' }).max(200),
    projectType: z.string().min(1, { message: 'نوع پروژه الزامی است.' }).max(200),
    budgetBillionRial: z
      .number({ invalid_type_error: 'بودجه باید عدد باشد.' })
      .min(0, { message: 'بودجه باید عدد مثبت باشد.' }),
    description: z.string().max(VALIDATION.DESCRIPTION_MAX_LENGTH).default(''),
    startDate: jalaliDateSchema,
    plannedEndDate: jalaliDateSchema,
    reportDate: jalaliDateSchema,
    logoUrl: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().default(true),
    version: z.number().int().nonnegative(),
  })
  .refine(
    (d) => {
      const s = toLatinDigits(d.startDate).replace(/-/g, '/');
      const e = toLatinDigits(d.plannedEndDate).replace(/-/g, '/');
      return e >= s;
    },
    { message: 'تاریخ پایان باید بعد از تاریخ شروع باشد.', path: ['plannedEndDate'] },
  );
export type ProjectFormInput = z.infer<typeof projectFormSchema>;

export const indicatorFormSchema = z.object({
  title: z.string().min(1, { message: 'عنوان شاخص الزامی است.' }).max(VALIDATION.TITLE_MAX_LENGTH),
  unit: z.string().max(100).nullable().optional(),
  plannedValue: z.number({ invalid_type_error: 'مقدار باید عدد باشد.' }),
  actualValue: z.number({ invalid_type_error: 'مقدار باید عدد باشد.' }),
  isPrimary: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),
});
export type IndicatorFormInput = z.infer<typeof indicatorFormSchema>;

export const monthlyProgressItemSchema = z.object({
  id: z.string().uuid().optional(),
  jalaliYear: z.number().int().min(1300).max(1500),
  jalaliMonth: z.number().int().min(1).max(12),
  monthLabel: z.string().min(1),
  plannedPercent: percentField,
  actualPercent: percentField.nullable(),
  notes: z.string().max(1000).nullable().optional(),
});
export type MonthlyProgressItemInput = z.infer<typeof monthlyProgressItemSchema>;

export const activityFormSchema = z.object({
  id: z.string().uuid().optional(),
  rowNumber: z.number().int().positive(),
  title: z.string().min(1, { message: 'عنوان فعالیت الزامی است.' }).max(VALIDATION.TITLE_MAX_LENGTH),
  weightPercent: percentField,
  startDate: jalaliDateSchema,
  endDate: jalaliDateSchema,
  plannedPercent: percentField,
  actualPercent: percentField,
  statusOverride: z.nativeEnum(ActivityStatus).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  displayOrder: z.number().int().nonnegative().default(0),
});
export type ActivityFormInput = z.infer<typeof activityFormSchema>;

export const riskFormSchema = z.object({
  id: z.string().uuid().optional(),
  rowNumber: z.number().int().positive(),
  title: z.string().min(1, { message: 'عنوان ریسک الزامی است.' }).max(VALIDATION.TITLE_MAX_LENGTH),
  probability: z.nativeEnum(Probability),
  riskLevel: z.nativeEnum(RiskLevel),
  mitigationAction: z.string().max(VALIDATION.DESCRIPTION_MAX_LENGTH).default(''),
  owner: z.string().max(200).default(''),
  dueDate: optionalJalaliDateSchema,
  status: z.string().max(200).nullable().optional(),
  displayOrder: z.number().int().nonnegative().default(0),
});
export type RiskFormInput = z.infer<typeof riskFormSchema>;

export const decisionFormSchema = z.object({
  id: z.string().uuid().optional(),
  rowNumber: z.number().int().positive(),
  subject: z.string().max(VALIDATION.TITLE_MAX_LENGTH).nullable().optional(),
  description: z.string().max(VALIDATION.DESCRIPTION_MAX_LENGTH).nullable().optional(),
  owner: z.string().max(200).nullable().optional(),
  dueDate: optionalJalaliDateSchema,
  status: z.nativeEnum(DecisionStatus),
  displayOrder: z.number().int().nonnegative().default(0),
});
export type DecisionFormInput = z.infer<typeof decisionFormSchema>;

export const userFormSchema = z.object({
  username: z
    .string()
    .min(VALIDATION.USERNAME_MIN_LENGTH, { message: 'نام کاربری خیلی کوتاه است.' })
    .max(VALIDATION.USERNAME_MAX_LENGTH),
  fullName: z.string().min(1, { message: 'نام کامل الزامی است.' }).max(200),
  role: z.nativeEnum(UserRole),
  password: strongPasswordSchema,
});
export type UserFormInput = z.infer<typeof userFormSchema>;
