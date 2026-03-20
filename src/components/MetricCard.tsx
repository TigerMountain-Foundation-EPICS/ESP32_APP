import { Sparkline } from "./charts/Sparkline";
import { Card } from "./ui/Card";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: number[];
}

export const MetricCard = ({ title, value, subtitle, trend }: MetricCardProps) => (
  <Card className="overflow-hidden">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-brand-navy">{title}</p>
        <p className="mt-3 text-4xl font-extrabold leading-none text-brand-navy">{value}</p>
        <p className="mt-3 inline-flex max-w-full rounded-full bg-brand-cream px-3 py-1 text-xs font-bold text-brand-olive">
          {subtitle}
        </p>
      </div>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-brand-cream text-brand-orange">
        <span className="h-5 w-5 rounded-full border-4 border-current/25 border-t-current" />
      </div>
    </div>
    <div className="mt-4 rounded-[24px] bg-brand-cream/75 p-3">
      <Sparkline values={trend} />
    </div>
  </Card>
);
