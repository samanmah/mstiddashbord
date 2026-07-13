import type { MonthlyProgressDto } from '@ppm/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MonthlyLineChart } from './monthly-line-chart';

function month(overrides: Partial<MonthlyProgressDto>): MonthlyProgressDto {
  return {
    id: 'm',
    projectId: 'p1',
    jalaliYear: 1405,
    jalaliMonth: 4,
    monthLabel: 'تیر (1405)',
    sortOrder: 140504,
    plannedPercent: 5,
    actualPercent: null,
    deviationPercent: null,
    notes: null,
    ...overrides,
  };
}

describe('MonthlyLineChart', () => {
  it('renders without crashing when actual values are null', () => {
    render(
      <MonthlyLineChart
        data={[
          month({ id: 'm1', monthLabel: 'تیر (1405)', plannedPercent: 5, actualPercent: null }),
          month({ id: 'm2', monthLabel: 'مرداد (1405)', sortOrder: 140505, plannedPercent: 15, actualPercent: null }),
        ]}
      />,
    );
    expect(screen.getByText('برنامه')).toBeInTheDocument();
    expect(screen.getByText('واقعی')).toBeInTheDocument();
  });

  it('toggles a series off when its legend is clicked', async () => {
    const user = userEvent.setup();
    render(<MonthlyLineChart data={[month({ id: 'm1' })]} />);
    const plannedToggle = screen.getByRole('button', { name: /برنامه/ });
    expect(plannedToggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(plannedToggle);
    expect(plannedToggle).toHaveAttribute('aria-pressed', 'false');
  });
});
