import { Wrench } from 'lucide-react';

export default function MaintenancePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page p-6 text-center">
      <Wrench className="h-12 w-12 text-navy-700" aria-hidden />
      <p className="text-2xl font-bold text-navy-900">سامانه در حال به‌روزرسانی است</p>
      <p className="max-w-md text-sm text-grayx-header">
        در حال انجام عملیات نگهداری هستیم. لطفاً چند دقیقهٔ دیگر دوباره مراجعه کنید.
      </p>
    </main>
  );
}
