'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@ppm/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isApiError } from '@/lib/api-error';
import { AUTH_QUERY_KEY } from '@/hooks/use-auth';
import { authService } from '@/lib/services';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', rememberMe: false },
  });

  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      const redirect = searchParams.get('redirect');
      const target =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : '/dashboard';
      router.replace(target);
      router.refresh();
    },
    onError: (error) => {
      if (isApiError(error)) {
        setFormError(error.message);
      } else {
        setFormError('خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.');
      }
    },
  });

  const onKeyEvent = (e: KeyboardEvent<HTMLInputElement>): void => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  };

  return (
    <div className="w-full max-w-md animate-fade-in rounded-card bg-white p-8 shadow-cardhover">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-800 text-white">
          <Lock className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-lg font-bold text-navy-900">
          سامانه پایش پیشرفت پروژه‌های استراتژیک
        </h1>
        <p className="text-sm text-grayx-header">برای ادامه وارد حساب کاربری خود شوید</p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
        className="space-y-4"
      >
        {formError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="username">
            نام کاربری
          </label>
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            hasError={Boolean(errors.username)}
            {...register('username')}
          />
          {errors.username ? <p className="field-error">{errors.username.message}</p> : null}
        </div>

        <div>
          <label className="label" htmlFor="password">
            رمز عبور
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              hasError={Boolean(errors.password)}
              className="pl-10"
              onKeyUp={onKeyEvent}
              onKeyDown={onKeyEvent}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 left-0 flex items-center px-3 text-grayx-header hover:text-ink"
              aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
          {capsLock ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-brand-orange">
              <ShieldAlert className="h-3.5 w-3.5" />
              کلید Caps Lock روشن است
            </p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 rounded" {...register('rememberMe')} />
          مرا به خاطر بسپار
        </label>

        <Button type="submit" className="w-full" loading={mutation.isPending}>
          ورود
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-grayx-dot">نسخهٔ سامانه {APP_VERSION}</p>
    </div>
  );
}
