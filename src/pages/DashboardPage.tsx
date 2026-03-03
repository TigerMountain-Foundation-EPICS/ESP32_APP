import { Activity, CloudOff, Droplets, Leaf } from "lucide-react";
import { MetricCard } from "../components/MetricCard";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { formatPercent, formatTempLabel, formatTimestamp } from "../utils/format";

const sliceTrend = (values: number[]): number[] => values.slice(0, 20).reverse();

export const DashboardPage = () => {
  const { snapshot, latestReading, readings, localOnly } = useConnectionState();
  const { settings } = useSettings();

  if (!latestReading) {
    return (
      <EmptyState
        title="Waiting for sensor data"
        description="Connect a BLE device or keep Demo Mode enabled to populate the dashboard."
      />
    );
  }

  const tempTrend = sliceTrend(readings.map((item) => item.temperatureC));
  const humidityTrend = sliceTrend(readings.map((item) => item.humidityPct));
  const soilTrend = sliceTrend(readings.map((item) => item.soilPct));

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Temperature"
          value={formatTempLabel(latestReading.temperatureC, settings.units)}
          subtitle="Ambient"
          trend={tempTrend}
        />
        <MetricCard
          title="Humidity"
          value={formatPercent(latestReading.humidityPct)}
          subtitle="Relative"
          trend={humidityTrend}
        />
        <MetricCard
          title="Soil Moisture"
          value={formatPercent(latestReading.soilPct)}
          subtitle={`Raw ${Math.round(latestReading.soilRawOrPct)}`}
          trend={soilTrend}
        />
        <MetricCard
          title="Status"
          value={snapshot.status.toUpperCase()}
          subtitle={snapshot.device?.name ?? "No device"}
          trend={sliceTrend(readings.map((item) => item.batteryV ?? 3.8))}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick Health</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" /> Last packet: {formatTimestamp(snapshot.lastPacketAt)}
            </p>
            <p className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-accent" /> Humidity threshold: {settings.thresholds.humidityLowPct}%
            </p>
            <p className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-accent" /> Soil alert threshold: {settings.thresholds.soilLowPct}%
            </p>
            <p className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-accent" />
              {localOnly ? "Local-first mode active" : "Firebase sync active"}
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Current Packet</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">Device</dt>
            <dd className="font-medium text-slate-900">{latestReading.deviceId}</dd>
            <dt className="text-slate-500">Source</dt>
            <dd className="font-medium text-slate-900">{latestReading.source}</dd>
            <dt className="text-slate-500">Battery</dt>
            <dd className="font-medium text-slate-900">{latestReading.batteryV?.toFixed(2) ?? "--"} V</dd>
            <dt className="text-slate-500">Updated</dt>
            <dd className="font-medium text-slate-900">{formatTimestamp(latestReading.timestamp)}</dd>
          </dl>
        </Card>
      </section>
    </div>
  );
};
