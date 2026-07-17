'use client';

import { dateToJalaliString } from '@ppm/contracts';
import {
  BarChart3,
  CheckCircle2,
  GitBranch,
  ListTree,
  Milestone,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { isApiError } from '@/lib/api-error';
import { useEnableControl } from '../../hooks/use-control-plan';

const FEATURES = [
  { icon: ListTree, title: 'ساختار شکست کار نامحدود', desc: 'WBS چندسطحی با فاز، بسته کاری، فعالیت و نقطه عطف.' },
  { icon: BarChart3, title: 'داشبورد مدیریتی', desc: 'شاخص‌های اجرایی، منحنی S و ارزش کسب‌شده.' },
  { icon: GitBranch, title: 'روابط و مسیر بحرانی', desc: 'وابستگی‌ها، تشخیص چرخه و تحلیل بحرانی.' },
  { icon: Milestone, title: 'خط مبنا و مقایسه', desc: 'ثبت Baseline و مقایسهٔ برنامه با وضعیت فعلی.' },
  { icon: Upload, title: 'ورود اطلاعات Excel/MPP', desc: 'Importer چندمرحله‌ای با اعتبارسنجی Manifest.' },
  { icon: ShieldCheck, title: 'کیفیت داده', desc: 'پایش تاریخ، وزن، مسئول و وابستگی نامعتبر.' },
];

export function EnableControlPanel({
  projectId,
  projectTitle,
  canEnable,
}: {
  projectId: string;
  projectTitle: string;
  canEnable: boolean;
}): React.JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [title, setTitle] = useState('برنامهٔ کنترل پروژه');
  const [statusDate, setStatusDate] = useState(() => dateToJalaliString(new Date()));
  const enable = useEnableControl(projectId);

  const submit = (): void => {
    if (!title.trim()) {
      toast.error('عنوان برنامهٔ کنترل الزامی است');
      return;
    }
    if (!statusDate) {
      toast.error('تاریخ وضعیت الزامی است');
      return;
    }
    enable.mutate(
      { title: title.trim(), statusDate },
      {
        onSuccess: () => {
          toast.success('کنترل پروژه فعال شد');
          setConfirmOpen(false);
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'فعال‌سازی ناموفق بود'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div className="card p-6 text-center">
        <h2 className="text-lg font-bold text-navy-900">کنترل پروژهٔ پیشرفته</h2>
        <p className="mt-2 text-sm leading-7 text-grayx-header">
          سامانهٔ کنترل پروژهٔ پیشرفته برای «{projectTitle}» هنوز فعال نشده است. با فعال‌سازی، ساختار
          شکست کار، داشبورد مدیریتی، گانت تعاملی و ابزار ورود اطلاعات در دسترس قرار می‌گیرد. داشبورد و
          بخش‌های فعلی پروژه بدون تغییر باقی می‌مانند.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card flex flex-col gap-2 p-4">
            <f.icon className="h-5 w-5 text-brand-blue" aria-hidden />
            <h3 className="text-sm font-bold text-navy-900">{f.title}</h3>
            <p className="text-xs leading-6 text-grayx-header">{f.desc}</p>
          </div>
        ))}
      </div>

      {canEnable ? (
        <div className="card space-y-4 p-6">
          <h3 className="text-sm font-bold text-navy-900">فعال‌سازی کنترل پروژه</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="عنوان برنامهٔ کنترل" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="تاریخ وضعیت (Status Date)" required>
              <JalaliDateInput value={statusDate} onChange={setStatusDate} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 className="h-4 w-4" /> فعال‌سازی کنترل پروژه
            </Button>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center text-sm text-grayx-header">
          کنترل پروژه برای این پروژه فعال نشده است. برای فعال‌سازی با مدیر پروژه (ویرایشگر) تماس بگیرید.
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="فعال‌سازی کنترل پروژه"
        variant="primary"
        confirmLabel="فعال‌سازی"
        message="با فعال‌سازی، یک برنامهٔ کنترل و ریشهٔ ساختار شکست کار ایجاد می‌شود. آیا ادامه می‌دهید؟"
        loading={enable.isPending}
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
