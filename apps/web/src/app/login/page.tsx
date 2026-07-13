import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'ورود | سامانه پایش پیشرفت پروژه‌های استراتژیک',
};

export default function LoginPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-900 to-navy-700 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
