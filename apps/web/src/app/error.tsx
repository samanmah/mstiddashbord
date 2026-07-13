'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page p-6 text-center">
      <p className="text-4xl font-bold text-brand-red">خطای غیرمنتظره</p>
      <p className="max-w-md text-sm text-grayx-header">
        متأسفانه در نمایش این صفحه خطایی رخ داد. می‌توانید دوباره تلاش کنید.
      </p>
      <button className="btn btn-primary" onClick={() => reset()}>
        تلاش دوباره
      </button>
    </main>
  );
}
