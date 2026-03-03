import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { formatTempLabel, formatTimestamp, toDisplayTemp } from "../utils/format";
import { movingAverage } from "../utils/math";

export const LivePage = () => {
  const { readings, latestReading, logReading } = useConnectionState();
  const { settings } = useSettings();

  const chartData = useMemo(() => {
    const points = readings.slice(0, 40).reverse();
    const smoothed = movingAverage(points.map((item) => item.temperatureC), 6);

    return points.map((item, index) => ({
      ts: new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      temperature: toDisplayTemp(item.temperatureC, settings.units),
      smoothed: toDisplayTemp(smoothed[index], settings.units),
      humidity: item.humidityPct,
      soil: item.soilPct
    }));
  }, [readings, settings.units]);

  if (!latestReading) {
    return (
      <EmptyState
        title="No live stream yet"
        description="Connect to BLE or run demo mode to view the real-time stream."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Live Stream</h2>
            <p className="text-sm text-slate-500">Smoothed with moving average (window 6)</p>
          </div>
          <Button onClick={() => logReading(latestReading)} variant="secondary">
            Log Reading
          </Button>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={45} />
              <Tooltip />
              <Line type="monotone" dataKey="temperature" stroke="#1e293b" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="smoothed" stroke="#2563eb" strokeWidth={2.8} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Latest Reading</h3>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>Temperature: {formatTempLabel(latestReading.temperatureC, settings.units)}</p>
          <p>Humidity: {latestReading.humidityPct.toFixed(1)}%</p>
          <p>Soil: {latestReading.soilPct.toFixed(1)}%</p>
          <p>Updated: {formatTimestamp(latestReading.timestamp)}</p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Packets</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Temp</th>
                <th className="pb-2">Humidity</th>
                <th className="pb-2">Soil</th>
                <th className="pb-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(0, 12).map((reading) => (
                <tr key={reading.id} className="border-t border-border">
                  <td className="py-2">{formatTimestamp(reading.timestamp)}</td>
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
