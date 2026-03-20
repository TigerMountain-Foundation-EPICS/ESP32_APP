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
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Plant 01</p>
            <h2 className="mt-2 text-3xl text-brand-navy">Live soil moisture</h2>
            <p className="section-copy mt-2">Smoothed sensor history with the current moisture level featured first.</p>
          </div>
          <Button onClick={() => logReading(latestReading)} variant="secondary">
            Log Reading
          </Button>
        </div>

        <div className="soft-panel">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-sm font-bold text-brand-sage">Current</p>
              <p className="mt-2 text-5xl font-extrabold leading-none text-brand-sage">
                {latestReading.soilPct.toFixed(0)}%
              </p>
            </div>
            <div className="text-sm text-slate-500">
              <p>Last updated {formatTimestamp(latestReading.timestamp)}</p>
              <p>Stream window {chartData.length} recent packets</p>
            </div>
          </div>

          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="ts"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="soil" stroke="#76a8a2" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="humidity" stroke="#cfd9d3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        <p className="eyebrow">Current Conditions</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Temperature</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">
              {formatTempLabel(latestReading.temperatureC, settings.units)}
            </p>
          </div>
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Humidity</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">{latestReading.humidityPct.toFixed(0)}%</p>
          </div>
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Soil Moisture</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">{latestReading.soilPct.toFixed(0)}%</p>
          </div>
          <div className="stat-tile">
            <p className="text-sm text-slate-500">Battery</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-navy">
              {latestReading.batteryV?.toFixed(2) ?? "--"}V
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <p className="eyebrow">Recent Packets</p>
        <div className="mt-3 overflow-x-auto">
          <table className="app-table min-w-[520px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Temp</th>
                <th>Humidity</th>
                <th>Soil</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(0, 12).map((reading) => (
                <tr key={reading.id}>
                  <td>{formatTimestamp(reading.timestamp)}</td>
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
