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
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Start</span>
            <input
              type="date"
              value={startDay}
              onChange={(event) => setStartDay(event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">End</span>
            <input
              type="date"
              value={endDay}
              onChange={(event) => setEndDay(event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
        </div>

        {readingsQuery.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : chartData.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={46} />
                <Tooltip />
                <Line type="monotone" dataKey="temp" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="humidity" stroke="#1e293b" strokeWidth={1.8} dot={false} />
                <Line type="monotone" dataKey="soil" stroke="#0f766e" strokeWidth={1.6} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No records found" description="Adjust the date range or log more readings." />
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Daily Aggregates</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Day</th>
                <th className="pb-2">Temp Min/Avg/Max</th>
                <th className="pb-2">Humidity Min/Avg/Max</th>
                <th className="pb-2">Soil Min/Avg/Max</th>
                <th className="pb-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {(aggregatesQuery.data ?? []).map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="py-2">{formatDateOnly(entry.day)}</td>
                  <td className="py-2">
                    {formatTempLabel(entry.minTemperatureC, settings.units)} /{" "}
                    {formatTempLabel(entry.avgTemperatureC, settings.units)} /{" "}
                    {formatTempLabel(entry.maxTemperatureC, settings.units)}
                  </td>
                  <td className="py-2">
                    {entry.minHumidityPct.toFixed(1)}% / {entry.avgHumidityPct.toFixed(1)}% /{" "}
                    {entry.maxHumidityPct.toFixed(1)}%
                  </td>
                  <td className="py-2">
                    {entry.minSoilPct.toFixed(1)}% / {entry.avgSoilPct.toFixed(1)}% / {entry.maxSoilPct.toFixed(1)}%
                  </td>
                  <td className="py-2">{entry.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Reading Table</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Temp</th>
                <th className="pb-2">Humidity</th>
                <th className="pb-2">Soil</th>
                <th className="pb-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {(readingsQuery.data ?? []).slice(0, 60).map((reading) => (
                <tr key={reading.id} className="border-t border-border">
                  <td className="py-2">{new Date(reading.timestamp).toLocaleString()}</td>
                  <td className="py-2">{formatTempLabel(reading.temperatureC, settings.units)}</td>
                  <td className="py-2">{reading.humidityPct.toFixed(1)}%</td>
                  <td className="py-2">{reading.soilPct.toFixed(1)}%</td>
                  <td className="py-2 uppercase tracking-wide text-slate-500">{reading.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
