import type { IndicatorSummary } from '@ppm/contracts';
import { EMPTY_PLACEHOLDER } from '@ppm/contracts';
import { Target } from 'lucide-react';
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
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="section-icon bg-accent-violet/15 text-accent-violet">
            <Target className="h-[18px] w-[18px]" aria-hidden />
          </span>
          شاخص اثربخشی پروژه
        </span>
      }
      headerTone="navy"
      className="border-t-2 border-t-accent-violet"
      bodyClassName="flex flex-col gap-3"
    >
      <div className="flex items-center justify-around gap-3">
        <DonutGauge
          gaugeValue={summary.achievementGaugeValue}
          displayValue={summary.achievementPercent}
          color="#7C5CFC"
          size={124}
          emptyLabel="N/A"
        />
        <div className="flex flex-col gap-3 text-center">
          <div>
            <p className="text-3xl font-extrabold tabular-nums text-accent-emerald">
              {indicator ? faNumber(indicator.actualValue) : EMPTY_PLACEHOLDER}
            </p>
            <p className="text-xs font-medium text-grayx-header">واقعی شاخص</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold tabular-nums text-accent-blue">
              {indicator ? faNumber(indicator.plannedValue) : EMPTY_PLACEHOLDER}
            </p>
            <p className="text-xs font-medium text-grayx-header">برنامه شاخص</p>
          </div>
        </div>
      </div>
      <p className="rounded-xl bg-surface px-3 py-2 text-center text-xs leading-5 text-ink ring-1 ring-inset ring-borderx/70">
        {indicator ? orDash(indicator.title) : 'شاخصی تعریف نشده است'}
      </p>
    </Card>
  );
}
