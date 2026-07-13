import Link from 'next/link';

export default function ForbiddenPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page p-6 text-center">
      <p className="text-5xl font-bold text-navy-900">۴۰۳</p>
      <p className="text-lg font-medium text-ink">دسترسی به این بخش برای شما مجاز نیست.</p>
      <Link href="/dashboard" className="btn btn-primary">
        بازگشت به داشبورد
      </Link>
    </main>
  );
}
