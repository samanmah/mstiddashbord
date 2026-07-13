'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  USER_ROLE_LABELS,
  UserRole,
  strongPasswordSchema,
  userFormSchema,
  type UserDto,
  type UserFormInput,
} from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Power, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Field } from '@/components/admin/field';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { userService } from '@/lib/services';
import { isoToJalaliFa } from '@/lib/utils';

const ROLE_OPTIONS = [
  { value: UserRole.MANAGER_VIEWER, label: USER_ROLE_LABELS.MANAGER_VIEWER },
  { value: UserRole.PROJECT_EDITOR, label: USER_ROLE_LABELS.PROJECT_EDITOR },
];

export default function UsersPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const [statusTarget, setStatusTarget] = useState<UserDto | null>(null);

  const query = { page, pageSize: 10, search: search || undefined, role: roleFilter || undefined };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', query],
    queryFn: () => userService.list(query),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const statusMutation = useMutation({
    mutationFn: (u: UserDto) => userService.setStatus(u.id, !u.isActive),
    onSuccess: () => {
      toast.success('وضعیت کاربر تغییر کرد');
      setStatusTarget(null);
      invalidate();
    },
    onError: (e) => {
      toast.error(isApiError(e) ? e.message : 'عملیات ناموفق بود');
      setStatusTarget(null);
    },
  });

  return (
    <>
      <PageHeader
        title="مدیریت کاربران"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> کاربر جدید
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grayx-dot" />
          <Input
            className="w-64 pr-9"
            placeholder="جستجو بر اساس نام یا نام کاربری…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-48"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          options={[{ value: '', label: 'همهٔ نقش‌ها' }, ...ROLE_OPTIONS]}
        />
      </div>

      {isLoading ? (
        <FullPageSpinner label="در حال بارگذاری…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="کاربری یافت نشد" />
      ) : (
        <>
          <div className="table-wrap card">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-right">نام کامل</th>
                  <th>نام کاربری</th>
                  <th>نقش</th>
                  <th>وضعیت</th>
                  <th>آخرین ورود</th>
                  <th className="w-32">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="text-right">{u.fullName}</td>
                    <td dir="ltr">{u.username}</td>
                    <td>{USER_ROLE_LABELS[u.role]}</td>
                    <td>
                      <StatusBadge
                        tone={u.isActive ? 'green' : 'gray'}
                        label={u.isActive ? 'فعال' : 'غیرفعال'}
                      />
                    </td>
                    <td>{u.lastLoginAt ? isoToJalaliFa(u.lastLoginAt) : '—'}</td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded p-1.5 text-navy-700 hover:bg-page"
                          onClick={() => setEditing(u)}
                          aria-label="ویرایش"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-brand-blue hover:bg-page"
                          onClick={() => setResetting(u)}
                          aria-label="بازنشانی رمز"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-brand-orange hover:bg-page"
                          onClick={() => setStatusTarget(u)}
                          aria-label="تغییر وضعیت"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-grayx-header">
              مجموع: {data.total} کاربر
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                قبلی
              </Button>
              <span>
                صفحهٔ {data.page} از {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </Button>
            </div>
          </div>
        </>
      )}

      {creating ? (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}
      {editing ? (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}
      {resetting ? (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.isActive ? 'غیرفعال‌سازی کاربر' : 'فعال‌سازی کاربر'}
        variant={statusTarget?.isActive ? 'danger' : 'primary'}
        confirmLabel={statusTarget?.isActive ? 'غیرفعال کن' : 'فعال کن'}
        message={`آیا از تغییر وضعیت کاربر «${statusTarget?.fullName ?? ''}» مطمئن هستید؟`}
        loading={statusMutation.isPending}
        onConfirm={() => statusTarget && statusMutation.mutate(statusTarget)}
        onCancel={() => setStatusTarget(null)}
      />
    </>
  );
}

function CreateUserModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormInput>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { username: '', fullName: '', role: UserRole.MANAGER_VIEWER, password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: UserFormInput) => userService.create(values),
    onSuccess: () => {
      toast.success('کاربر ایجاد شد');
      onSaved();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ایجاد ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="ایجاد کاربر"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            ایجاد
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Field label="نام کاربری" required error={errors.username?.message}>
          <Input dir="ltr" hasError={Boolean(errors.username)} {...register('username')} />
        </Field>
        <Field label="نام کامل" required error={errors.fullName?.message}>
          <Input hasError={Boolean(errors.fullName)} {...register('fullName')} />
        </Field>
        <Field label="نقش" error={errors.role?.message}>
          <Select options={ROLE_OPTIONS} {...register('role')} />
        </Field>
        <Field
          label="رمز عبور"
          required
          error={errors.password?.message}
          hint="حداقل ۱۲ کاراکتر شامل حرف بزرگ، کوچک، عدد و علامت ویژه"
        >
          <Input type="password" dir="ltr" hasError={Boolean(errors.password)} {...register('password')} />
        </Field>
      </form>
    </Modal>
  );
}

const editUserSchema = z.object({
  fullName: z.string().min(1, { message: 'نام کامل الزامی است.' }).max(200),
  role: z.nativeEnum(UserRole),
});
type EditUserInput = z.infer<typeof editUserSchema>;

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserDto;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditUserInput>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { fullName: user.fullName, role: user.role },
  });

  const mutation = useMutation({
    mutationFn: (values: EditUserInput) => userService.update(user.id, values),
    onSuccess: () => {
      toast.success('کاربر ویرایش شد');
      onSaved();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ویرایش ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`ویرایش کاربر: ${user.username}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            ذخیره
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Field label="نام کامل" required error={errors.fullName?.message}>
          <Input hasError={Boolean(errors.fullName)} {...register('fullName')} />
        </Field>
        <Field label="نقش" error={errors.role?.message}>
          <Select options={ROLE_OPTIONS} {...register('role')} />
        </Field>
      </form>
    </Modal>
  );
}

const resetSchema = z.object({ newPassword: strongPasswordSchema });
type ResetInput = z.infer<typeof resetSchema>;

function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserDto;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ResetInput) => userService.resetPassword(user.id, values),
    onSuccess: () => {
      toast.success('رمز عبور بازنشانی شد');
      onSaved();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'بازنشانی ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`بازنشانی رمز: ${user.username}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            بازنشانی رمز
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Field
          label="رمز عبور جدید"
          required
          error={errors.newPassword?.message}
          hint="حداقل ۱۲ کاراکتر شامل حرف بزرگ، کوچک، عدد و علامت ویژه"
        >
          <Input
            type="password"
            dir="ltr"
            hasError={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
        </Field>
      </form>
    </Modal>
  );
}
