'use client';

import { toLatinDigits, toPersianDigits } from '@ppm/contracts';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface JalaliDateInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  hasError?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * ورودی تاریخ جلالی با قالب YYYY/MM/DD.
 * اعداد فارسی/عربی/لاتین را می‌پذیرد و به‌صورت داخلی به لاتین ذخیره می‌کند،
 * اما به کاربر با ارقام فارسی نمایش می‌دهد.
 */
export const JalaliDateInput = forwardRef<HTMLInputElement, JalaliDateInputProps>(
  function JalaliDateInput(
    { value, onChange, onBlur, id, hasError, disabled, placeholder = '۱۴۰۵/۰۴/۰۱' },
    ref,
  ) {
    return (
      <input
        ref={ref}
        id={id}
        dir="ltr"
        inputMode="numeric"
        disabled={disabled}
        className={cn('input text-center', hasError && 'input-error')}
        placeholder={placeholder}
        value={value ? toPersianDigits(value) : ''}
        onChange={(e) => {
          const latin = toLatinDigits(e.target.value).replace(/[^0-9/]/g, '');
          onChange(latin);
        }}
        onBlur={onBlur}
        aria-label="تاریخ جلالی"
      />
    );
  },
);
