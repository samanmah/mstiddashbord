import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  ControlExecutiveKpis,
  DataQualityReport,
} from '../../api/project-control-types';
import { ControlNodeStatus } from '../../api/project-control-types';
import { makeNode } from '../../utils/wbs-fixtures';
import { CriticalTasksTable } from './critical-tasks-table';
import { DashboardDataQuality } from './dashboard-data-quality';
import { ExecutiveKpis } from './executive-kpis';

const kpis: ControlExecutiveKpis = {
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
};

describe('ExecutiveKpis', () => {
  it('renders KPI labels and null-safe values', () => {
    render(<ExecutiveKpis kpis={{ ...kpis, spi: null }} />);
    expect(screen.getByText('پیشرفت برنامه‌ای')).toBeInTheDocument();
    expect(screen.getByText('شاخص عملکرد زمان (SPI)')).toBeInTheDocument();
    // null SPI shows placeholder, not fake zero
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('DashboardDataQuality', () => {
  const clean: DataQualityReport = {
    nodesWithoutDates: 0,
    nodesWithoutWeight: 0,
    nodesWithoutOwner: 0,
    nodesWithoutDod: 0,
    invalidDependencies: 0,
    unbalancedWeightParents: 0,
    fileConflicts: 0,
    staleData: 0,
  };

  it('shows "no issues" when report is clean', () => {
    render(<DashboardDataQuality report={clean} />);
    expect(screen.getByText('بدون مسئله')).toBeInTheDocument();
  });

  it('shows issue count when problems exist', () => {
    render(<DashboardDataQuality report={{ ...clean, nodesWithoutDates: 2, invalidDependencies: 1 }} />);
    expect(screen.getByText('بدون تاریخ')).toBeInTheDocument();
  });
});

describe('CriticalTasksTable', () => {
  it('renders empty state without tasks', () => {
    render(<CriticalTasksTable tasks={[]} />);
    expect(screen.getByText('فعالیت بحرانی یا تأخیرداری وجود ندارد')).toBeInTheDocument();
  });

  it('renders a row per task', () => {
    const tasks = [
      makeNode({ id: 't1', title: 'فعالیت بحرانی', computed: { isCritical: true } }),
    ];
    render(<CriticalTasksTable tasks={tasks} />);
    expect(screen.getByText('فعالیت بحرانی')).toBeInTheDocument();
  });
});
