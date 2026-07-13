import { isValidJalaliDate, toLatinDigits } from '@ppm/contracts';
import {
  buildMessage,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function isJalaliDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parts = toLatinDigits(value.trim()).replace(/-/g, '/').split('/');
  if (parts.length !== 3) return false;
  return isValidJalaliDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
}

/** اعتبارسنجی رشته تاریخ جلالی (YYYY/MM/DD) در DTOها. */
export function IsJalaliDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isJalaliDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isJalaliDateString(value);
        },
        defaultMessage: buildMessage(
          (eachPrefix, args?: ValidationArguments) =>
            `${eachPrefix}مقدار «${args?.property}» تاریخ جلالی معتبری نیست (قالب صحیح: ۱۴۰۵/۰۴/۰۱).`,
          validationOptions,
        ),
      },
    });
  };
}

/** نسخه اختیاری: مقدار می‌تواند خالی/null باشد. */
export function IsOptionalJalaliDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isOptionalJalaliDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined || value === '') return true;
          return isJalaliDateString(value);
        },
        defaultMessage: buildMessage(
          (eachPrefix, args?: ValidationArguments) =>
            `${eachPrefix}مقدار «${args?.property}» تاریخ جلالی معتبری نیست.`,
          validationOptions,
        ),
      },
    });
  };
}
