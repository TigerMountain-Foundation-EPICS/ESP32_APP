import { Sparkline } from "./charts/Sparkline";
import { Card } from "./ui/Card";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: number[];
}

export const MetricCard = ({ title, value, subtitle, trend }: MetricCardProps) => (
  <Card className="space-y-3">
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
    <Sparkline values={trend} />
  </Card>
);
