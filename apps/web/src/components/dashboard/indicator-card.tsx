import type { IndicatorSummary } from '@ppm/contracts';
import { EMPTY_PLACEHOLDER } from '@ppm/contracts';
import { Card } from '@/components/ui/card';
import { DonutGauge } from '@/components/charts/donut-gauge';
import { faNumber, orDash } from '@/lib/utils';

export function IndicatorCard({
  summary,
}: {
  summary: IndicatorSummary;
}): React.JSX.Element {
  const indicator = summary.indicator;

  return (
    <Card title="شاخص اثربخشی پروژه" headerTone="navy" bodyClassName="flex flex-col gap-3">
      <div className="flex items-center justify-around gap-3">
        <DonutGauge
          gaugeValue={summary.achievementGaugeValue}
          displayValue={summary.achievementPercent}
          color="#2D9CDB"
          size={116}
          emptyLabel="N/A"
        />
        <div className="flex flex-col gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-brand-green">
              {indicator ? faNumber(indicator.actualValue) : EMPTY_PLACEHOLDER}
            </p>
            <p className="text-xs text-grayx-header">واقعی شاخص</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-navy-900">
              {indicator ? faNumber(indicator.plannedValue) : EMPTY_PLACEHOLDER}
            </p>
            <p className="text-xs text-grayx-header">برنامه شاخص</p>
          </div>
        </div>
      </div>
      <p className="rounded-lg bg-page px-3 py-2 text-center text-xs leading-5 text-ink">
        {indicator ? orDash(indicator.title) : 'شاخصی تعریف نشده است'}
      </p>
    </Card>
  );
}
