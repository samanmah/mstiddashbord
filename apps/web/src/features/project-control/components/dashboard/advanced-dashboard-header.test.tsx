import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlNodeStatus, type ControlDashboard } from '../../api/project-control-types';
import { AdvancedDashboardHeader } from './advanced-dashboard-header';

const push = vi.fn();
const clear = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ clear, user: null, isLoading: false, isError: false, isEditor: false, refetch: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/services', () => ({
  authService: { logout: vi.fn() },
}));

const dashboard: ControlDashboard = {
  project: {
    id: 'project-123',
    titleFa: 'پروژه آزمایشی',
    titleEn: 'Test Project',
    projectManager: 'مدیر',
    budgetBillionRial: 10,
  },
  controlPlan: {
    id: 'plan-1',
    title: 'Plan',
    statusDate: '1404/01/01',
    currency: 'IRR',
    version: 1,
  },
  executiveKpis: {
    plannedProgress: 40,
    actualProgress: 30,
    achievement: 75,
    scheduleVariancePercent: -10,
    status: ControlNodeStatus.AT_RISK,
    spi: 0.9,
    cpi: 1.05,
    budgetTotal: '1000000',
    actualCost: '400000',
    forecastFinish: '1405/12/29',
    finishVarianceDays: 12,
    criticalCount: 3,
    overdueCount: 2,
    blockedCount: 0,
    upcomingMilestones: 4,
  },
  phaseRollups: [],
  progressSeries: [],
  costSeries: [],
  milestoneSummary: {
    total: 0,
    completed: 0,
    upcoming: 0,
    delayed: 0,
  },
  criticalTasks: [],
  delayedTasks: [],
  upcomingTasks: [],
  ownerWorkload: [],
  dataQuality: {
    nodesWithoutDates: 0,
    nodesWithoutWeight: 0,
    nodesWithoutOwner: 0,
    nodesWithoutDod: 0,
    invalidDependencies: 0,
    unbalancedWeightParents: 0,
    fileConflicts: 0,
    staleData: 0,
  },
  risks: [],
  decisions: [],
  lastUpdatedAt: '2026-07-17T00:00:00.000Z',
};

function renderHeader(props: Partial<React.ComponentProps<typeof AdvancedDashboardHeader>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <AdvancedDashboardHeader
      dashboard={dashboard}
      projectId="project-123"
      isEditor={false}
      isFullscreen={false}
      isWallboard={false}
      onToggleFullscreen={vi.fn()}
      onToggleWallboard={vi.fn()}
      onRefresh={vi.fn()}
      {...props}
    />,
    { wrapper: Wrapper },
  );
}

describe('AdvancedDashboardHeader edit access', () => {
  beforeEach(() => {
    push.mockReset();
    clear.mockReset();
  });

  it('PROJECT_EDITOR: دکمه ویرایش پروژه نمایش داده می‌شود و کلیک به مسیر کنترل می‌رود', async () => {
    const user = userEvent.setup();
    renderHeader({ isEditor: true });

    const btn = screen.getByTestId('edit-project-button');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAccessibleName('ویرایش پروژه');
    expect(btn).toHaveTextContent('ویرایش پروژه');

    await user.click(btn);
    expect(push).toHaveBeenCalledWith('/admin/projects/project-123/control');
  });

  it('VIEWER: دکمه ویرایش وجود ندارد', () => {
    renderHeader({ isEditor: false });
    expect(screen.queryByTestId('edit-project-button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ویرایش پروژه' })).not.toBeInTheDocument();
  });

  it('Auth loading معادل isEditor=false: دکمه ویرایش نمایش داده نمی‌شود', () => {
    // caller هنگام isAuthLoading مقدار isEditor=false پاس می‌دهد
    renderHeader({ isEditor: false });
    expect(screen.queryByTestId('edit-project-button')).not.toBeInTheDocument();
  });

  it('Editor: دکمه‌های refresh/fullscreen/wallboard/print/logout همچنان هستند', () => {
    renderHeader({ isEditor: true });
    expect(screen.getByTestId('edit-project-button')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-dashboard-button')).toBeInTheDocument();
    expect(screen.getByTestId('fullscreen-dashboard-button')).toBeInTheDocument();
    expect(screen.getByTestId('wallboard-dashboard-button')).toBeInTheDocument();
    expect(screen.getByTestId('print-dashboard-button')).toBeInTheDocument();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
  });

  it('Viewer: داشبورد Read-only و عنوان پروژه قابل مشاهده است', () => {
    renderHeader({ isEditor: false });
    expect(screen.getByTestId('dashboard-project-title')).toHaveTextContent('پروژه آزمایشی');
    expect(screen.getByTestId('refresh-dashboard-button')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-project-button')).not.toBeInTheDocument();
  });
});
