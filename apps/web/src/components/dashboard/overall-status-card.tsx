import type { DashboardSummary } from '@ppm/contracts';
import { Gauge } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DonutGauge } from '@/components/charts/donut-gauge';
import { faPercent } from '@/lib/utils';

const ACTUAL_COLOR = '#10B981';
const PLANNED_COLOR = '#2563EB';

export function OverallStatusCard({
  summary,
}: {
  summary: DashboardSummary;
}): React.JSX.Element {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="section-icon bg-accent-emerald/15 text-accent-emerald">
            <Gauge className="h-[18px] w-[18px]" aria-hidden />
          </span>
          وضعیت کلی پروژه
        </span>
      }
      headerTone="navy"
      className="border-t-2 border-t-accent-emerald"
      bodyClassName="flex flex-col gap-3"
    >
      <div className="flex items-center justify-around gap-3">
        <DonutGauge
          gaugeValue={summary.achievementGaugeValue}
          displayValue={summary.achievementPercent}
          color={ACTUAL_COLOR}
          size={124}
          emptyLabel="فاقد برنامه"
        />
        <div className="flex flex-col gap-3 text-center">
          <StatBlock
            label="واقعی"
            value={faPercent(summary.actualProjectProgress)}
            color={ACTUAL_COLOR}
          />
          <StatBlock
            label="برنامه"
            value={faPercent(summary.plannedProjectProgress)}
            color={PLANNED_COLOR}
          />
        </div>
      </div>

      {summary.isBeyondPlan ? (
        <p className="text-center text-xs font-semibold text-accent-emerald">فراتر از برنامه</p>
      ) : null}

      <div className="rounded-xl bg-gradient-to-l from-navy-900 to-navy-700 py-2.5 text-center text-sm font-bold text-white shadow-sm">
        پیشرفت کل پروژه {faPercent(summary.actualProjectProgress)}
      </div>
    </Card>
  );
}

function StatBlock({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <div>
      <p className="text-3xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-xs font-medium text-grayx-header">{label}</p>
    </div>
  );
}
