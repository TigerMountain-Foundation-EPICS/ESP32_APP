import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { aggregateByDay, createDemoHistory } from "../services/demo";
import { firebaseService } from "../services/firebase";
import { formatDateOnly, formatTempLabel, toDisplayTemp } from "../utils/format";

const dateDaysAgo = (daysAgo: number): string => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

export const HistoryPage = () => {
  const { snapshot } = useConnectionState();
  const { settings } = useSettings();

  const [startDay, setStartDay] = useState<string>(dateDaysAgo(7));
  const [endDay, setEndDay] = useState<string>(dateDaysAgo(0));

  const deviceId = snapshot.device?.id ?? "demo-esp32";

  const readingsQuery = useQuery({
    queryKey: ["history", startDay, endDay, deviceId, settings.demoMode],
    queryFn: async () => {
      const startTs = new Date(`${startDay}T00:00:00`).getTime();
      const endTs = new Date(`${endDay}T23:59:59`).getTime();

      if (settings.demoMode) {
        const days = Math.max(1, Math.ceil((endTs - startTs) / (24 * 60 * 60 * 1000)));
        return createDemoHistory(days, settings, deviceId).filter(
          (reading) => reading.timestamp >= startTs && reading.timestamp <= endTs
        );
      }

      return firebaseService.getReadingsRange({ startTs, endTs, deviceId });
    }
  });

  const aggregatesQuery = useQuery({
    queryKey: ["aggregates", startDay, endDay, deviceId, settings.demoMode, readingsQuery.data?.length ?? 0],
    queryFn: async () => {
      if (settings.demoMode) {
        return aggregateByDay(readingsQuery.data ?? []);
      }
      return firebaseService.getDailyAggregates({ startDay, endDay, deviceId });
    },
    enabled: Boolean(deviceId) && !readingsQuery.isLoading
  });

  const chartData = useMemo(() => {
    const records = readingsQuery.data ?? [];
    return [...records]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((reading) => ({
        label: new Date(reading.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }),
        temp: toDisplayTemp(reading.temperatureC, settings.units),
        humidity: reading.humidityPct,
        soil: reading.soilPct
      }));
  }, [readingsQuery.data, settings.units]);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Weekly Report</p>
            <h2 className="mt-2 text-3xl text-brand-navy">Moisture and climate history</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-2 block text-slate-500">Start</span>
              <input
                type="date"
                value={startDay}
                onChange={(event) => setStartDay(event.target.value)}
                className="app-input"
              />
            </label>
            <label className="text-sm">
              <span className="mb-2 block text-slate-500">End</span>
              <input
                type="date"
                value={endDay}
                onChange={(event) => setEndDay(event.target.value)}
                className="app-input"
              />
            </label>
          </div>
        </div>

        {readingsQuery.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : chartData.length ? (
          <div className="soft-panel h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="temp" stroke="#ef7c28" strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="humidity" stroke="#17386c" strokeWidth={2.1} dot={false} />
                <Line type="monotone" dataKey="soil" stroke="#76a8a2" strokeWidth={2.6} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No records found" description="Adjust the date range or log more readings." />
        )}
      </Card>

      <Card>
        <p className="eyebrow">Reading Table</p>
        <div className="mt-3 overflow-x-auto">
          <table className="app-table min-w-[700px]">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Temp</th>
                <th>Humidity</th>
                <th>Soil</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(readingsQuery.data ?? []).slice(0, 60).map((reading) => (
                <tr key={reading.id}>
                  <td>{new Date(reading.timestamp).toLocaleString()}</td>
                  <td>{formatTempLabel(reading.temperatureC, settings.units)}</td>
                  <td>{reading.humidityPct.toFixed(1)}%</td>
                  <td>{reading.soilPct.toFixed(1)}%</td>
                  <td className="uppercase tracking-[0.16em] text-slate-500">{reading.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
