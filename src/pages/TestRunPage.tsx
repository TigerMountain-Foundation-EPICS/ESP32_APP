import { useMemo } from "react";
import { MetricCard } from "../components/MetricCard";
import { Card } from "../components/ui/Card";
import { createDemoHistory } from "../services/demo";
import { useSettings } from "../hooks/useSettings";
import { formatTempLabel } from "../utils/format";

export const TestRunPage = () => {
  const { settings } = useSettings();

  const sample = useMemo(() => createDemoHistory(2, settings), [settings]);
  const latest = sample[sample.length - 1];

  const tempTrend = sample.slice(-24).map((reading) => reading.temperatureC);
  const humidityTrend = sample.slice(-24).map((reading) => reading.humidityPct);
  const soilTrend = sample.slice(-24).map((reading) => reading.soilPct);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold">Test Run</h2>
        <p className="text-sm text-slate-500">Complete dashboard render with deterministic-looking sample data.</p>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Temperature"
          value={formatTempLabel(latest.temperatureC, settings.units)}
          subtitle="Sample stream"
          trend={tempTrend}
        />
        <MetricCard
          title="Humidity"
          value={`${latest.humidityPct.toFixed(1)}%`}
          subtitle="Sample stream"
          trend={humidityTrend}
        />
        <MetricCard
          title="Soil"
          value={`${latest.soilPct.toFixed(1)}%`}
          subtitle="Sample stream"
          trend={soilTrend}
        />
      </section>

      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sample Packets</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Temperature</th>
                <th className="pb-2">Humidity</th>
                <th className="pb-2">Soil</th>
              </tr>
            </thead>
            <tbody>
              {sample
                .slice(-20)
                .reverse()
                .map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="py-2">{formatTempLabel(row.temperatureC, settings.units)}</td>
                    <td className="py-2">{row.humidityPct.toFixed(1)}%</td>
                    <td className="py-2">{row.soilPct.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
