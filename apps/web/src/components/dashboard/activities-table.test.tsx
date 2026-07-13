import { ActivityStatus, type ActivityDto } from '@ppm/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivitiesTable } from './activities-table';

function makeActivity(overrides: Partial<ActivityDto> = {}): ActivityDto {
  return {
    id: 'a1',
    projectId: 'p1',
    rowNumber: 1,
    title: 'مطالعات اولیه',
    weightPercent: 20,
    startDate: '2026-06-22T12:00:00.000Z',
    endDate: '2026-09-22T12:00:00.000Z',
    plannedPercent: 100,
    actualPercent: 100,
    statusOverride: null,
    computedStatus: ActivityStatus.GOOD,
    effectiveStatus: ActivityStatus.GOOD,
    notes: null,
    displayOrder: 1,
    ...overrides,
  };
}

describe('ActivitiesTable', () => {
  it('shows an empty state when there are no activities', () => {
    render(<ActivitiesTable activities={[]} />);
    expect(screen.getByText('فعالیتی ثبت نشده است')).toBeInTheDocument();
  });

  it('renders a row per activity with its title', () => {
    render(
      <ActivitiesTable
        activities={[
          makeActivity({ id: 'a1', title: 'مطالعات اولیه', displayOrder: 1 }),
          makeActivity({ id: 'a2', title: 'طراحی مفهومی', displayOrder: 2 }),
        ]}
      />,
    );
    expect(screen.getByText('مطالعات اولیه')).toBeInTheDocument();
    expect(screen.getByText('طراحی مفهومی')).toBeInTheDocument();
  });

  it('renders the effective status label', () => {
    render(
      <ActivitiesTable
        activities={[makeActivity({ effectiveStatus: ActivityStatus.WEAK })]}
      />,
    );
    expect(screen.getByText('ضعیف')).toBeInTheDocument();
  });
});
