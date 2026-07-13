import type { DashboardSummary } from '@ppm/contracts';
import { Card } from '@/components/ui/card';
import { DonutGauge } from '@/components/charts/donut-gauge';
import { faPercent } from '@/lib/utils';

export function OverallStatusCard({
  summary,
}: {
  summary: DashboardSummary;
}): React.JSX.Element {
  return (
    <Card title="وضعیت کلی پروژه" headerTone="gray" bodyClassName="flex flex-col gap-3">
      <div className="flex items-center justify-around gap-3">
        <DonutGauge
          gaugeValue={summary.achievementGaugeValue}
          displayValue={summary.achievementPercent}
          color="#20A55A"
          size={116}
          emptyLabel="فاقد برنامه"
        />
        <div className="flex flex-col gap-3 text-center">
          <StatBlock
            label="واقعی"
            value={faPercent(summary.actualProjectProgress)}
            color="#20A55A"
          />
          <StatBlock
            label="برنامه"
            value={faPercent(summary.plannedProjectProgress)}
            color="#17345F"
          />
        </div>
      </div>

      {summary.isBeyondPlan ? (
        <p className="text-center text-xs font-medium text-brand-green">فراتر از برنامه</p>
      ) : null}

      <div className="rounded-lg bg-navy-800 py-2 text-center text-sm font-bold text-white">
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
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-grayx-header">{label}</p>
    </div>
  );
}
