import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlNodeStatus, type ControlDashboard } from '../../api/project-control-types';
import { AdvancedDashboardView } from './advanced-dashboard-view';

const authState = vi.hoisted(() => ({
  isEditor: false,
  isLoading: false,
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: authState.isLoading,
    isError: false,
    isEditor: authState.isEditor,
    refetch: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    'data-testid'?: string;
    className?: string;
  }) => (
    <a href={href} data-testid={rest['data-testid']} className={rest.className}>
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../gantt/gantt-chart', () => ({
  GanttChart: () => <div data-testid="gantt-chart-stub" />,
}));

const dashboard: ControlDashboard = {
  project: {
    id: 'project-123',
    titleFa: 'پروژه آزمایشی',
    titleEn: null,
    projectManager: null,
    budgetBillionRial: null,
  },
  controlPlan: {
    id: 'plan-1',
    title: 'Plan',
    statusDate: '1404/01/01',
    currency: 'IRR',
    version: 1,
  },
  executiveKpis: {
    plannedProgress: 10,
    actualProgress: 8,
    achievement: 80,
    scheduleVariancePercent: -2,
    status: ControlNodeStatus.ON_TRACK,
    spi: 1,
    cpi: 1,
    budgetTotal: null,
    actualCost: null,
    forecastFinish: null,
    finishVarianceDays: null,
    criticalCount: 0,
    overdueCount: 0,
    blockedCount: 0,
    upcomingMilestones: 0,
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

vi.mock('../../hooks/use-control-dashboard', () => ({
  useControlDashboard: () => ({
    isLoading: false,
    isError: false,
    data: dashboard,
    error: null,
    refetch: vi.fn(),
  }),
  useSCurve: () => ({ data: [] }),
}));

vi.mock('../../hooks/use-control-gantt', () => ({
  useControlGantt: () => ({ data: { nodes: [] } }),
}));

vi.mock('../../hooks/use-control-baselines', () => ({
  useBaselines: () => ({ data: [] }),
}));

vi.mock('@/lib/services', () => ({
  authService: { logout: vi.fn(), me: vi.fn() },
  projectService: { get: vi.fn().mockResolvedValue({ projectCode: 'STG-PC-001' }) },
  riskService: { list: vi.fn().mockResolvedValue([]) },
  decisionService: { list: vi.fn().mockResolvedValue([]) },
}));

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdvancedDashboardView projectId="project-123" />
    </QueryClientProvider>,
  );
}

describe('AdvancedDashboardView editor access notice', () => {
  beforeEach(() => {
    authState.isEditor = false;
    authState.isLoading = false;
  });

  it('Editor: دکمه هدر و لینک پایین صفحه را می‌بیند', () => {
    authState.isEditor = true;
    renderView();
    expect(screen.getByTestId('edit-project-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-project-footer-link')).toHaveAttribute(
      'href',
      '/admin/projects/project-123/control',
    );
    expect(screen.getByTestId('editor-readonly-notice')).toHaveTextContent(
      'این داشبورد نمای مدیریتی و فقط‌خواندنی است.',
    );
    expect(screen.getByTestId('executive-kpis')).toBeInTheDocument();
  });

  it('Viewer: دکمه ویرایش و لینک پایین صفحه وجود ندارد؛ KPIها دیده می‌شوند', () => {
    authState.isEditor = false;
    renderView();
    expect(screen.queryByTestId('edit-project-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-project-footer-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('editor-readonly-notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('advanced-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('executive-kpis')).toBeInTheDocument();
  });

  it('Auth loading: دکمه ویرایش Flash نمی‌شود', () => {
    authState.isLoading = true;
    authState.isEditor = true; // حتی اگر cache قبلی editor باشد تا me کامل نشود نشان نده
    renderView();
    expect(screen.queryByTestId('edit-project-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-project-footer-link')).not.toBeInTheDocument();
  });
});
