import { AppSettings, SensorReading } from "../types";
import { clamp } from "../utils/math";

interface DemoGeneratorOptions {
  intervalMs?: number;
  deviceId?: string;
  connected?: boolean;
  onReading: (reading: SensorReading) => void;
}

export const DEFAULT_DEMO_DEVICE_ID = "demo-esp32";

const random = (min: number, max: number): number => Math.random() * (max - min) + min;

const soilRawToPct = (raw: number, min: number, max: number): number => {
  const normalized = (raw - min) / Math.max(1, max - min);
  return clamp((1 - normalized) * 100, 0, 100);
};

export class DemoDataGenerator {
  private timer: number | null = null;

  private temperatureC = 24.2;

  private humidityPct = 52;

  private soilRaw = 1900;

  private phase = 0;

  constructor(private readonly settings: Pick<AppSettings, "soilCalibration">) {}

  start(options: DemoGeneratorOptions): void {
    this.stop();
    const interval = options.intervalMs ?? 2200;
    const deviceId = options.deviceId ?? DEFAULT_DEMO_DEVICE_ID;

    this.timer = window.setInterval(() => {
      this.phase += 0.17;
      const circadian = Math.sin(this.phase) * 0.15;

      this.temperatureC = clamp(this.temperatureC + random(-0.16, 0.16) + circadian, 18, 34);
      this.humidityPct = clamp(this.humidityPct + random(-0.9, 0.9) - circadian * 6, 25, 84);
      this.soilRaw = clamp(this.soilRaw + random(-35, 26), 1100, 3400);

      const reading: SensorReading = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        temperatureC: Number(this.temperatureC.toFixed(2)),
        humidityPct: Number(this.humidityPct.toFixed(2)),
        soilRawOrPct: Math.round(this.soilRaw),
        soilPct: Number(
          soilRawToPct(
            this.soilRaw,
            this.settings.soilCalibration.min,
            this.settings.soilCalibration.max
          ).toFixed(2)
        ),
        batteryV: Number(random(3.7, 4.12).toFixed(2)),
        deviceId,
        source: "demo"
      };

      options.onReading(reading);
    }, interval);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const createDemoHistory = (
  days: number,
  settings: Pick<AppSettings, "soilCalibration">,
  deviceId = DEFAULT_DEMO_DEVICE_ID
): SensorReading[] => {
  const pointsPerDay = 48;
  const total = Math.max(1, Math.floor(days * pointsPerDay));
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;

  const readings: SensorReading[] = [];
  let temperature = 23.8;
  let humidity = 50;
  let soilRaw = 1800;

  for (let i = 0; i < total; i += 1) {
    const timestamp = start + (i / total) * (now - start);
    const cycle = Math.sin(i / 8) * 0.2;

    temperature = clamp(temperature + random(-0.19, 0.19) + cycle, 17, 35);
    humidity = clamp(humidity + random(-1.2, 1.2) - cycle * 4, 20, 88);
    soilRaw = clamp(soilRaw + random(-30, 24), 1050, 3480);

    readings.push({
      id: `demo-h-${i}`,
      timestamp,
      temperatureC: Number(temperature.toFixed(2)),
      humidityPct: Number(humidity.toFixed(2)),
      soilRawOrPct: Math.round(soilRaw),
      soilPct: Number(
        soilRawToPct(soilRaw, settings.soilCalibration.min, settings.soilCalibration.max).toFixed(2)
      ),
      batteryV: Number((3.8 + Math.sin(i / 20) * 0.12).toFixed(2)),
      deviceId,
      source: "demo"
    });
  }

  return readings;
};

export const aggregateByDay = (readings: SensorReading[]) => {
  const buckets = new Map<string, SensorReading[]>();

  readings.forEach((reading) => {
    const day = new Date(reading.timestamp).toISOString().slice(0, 10);
    const group = buckets.get(day) ?? [];
    group.push(reading);
    buckets.set(day, group);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, group]) => {
      const count = group.length;
      const temps = group.map((reading) => reading.temperatureC);
      const humidity = group.map((reading) => reading.humidityPct);
      const soil = group.map((reading) => reading.soilPct);

      const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
      return {
        id: `${group[0].deviceId}-${day}`,
        day,
        deviceId: group[0].deviceId,
        count,
        minTemperatureC: Math.min(...temps),
        maxTemperatureC: Math.max(...temps),
        avgTemperatureC: sum(temps) / count,
        minHumidityPct: Math.min(...humidity),
        maxHumidityPct: Math.max(...humidity),
        avgHumidityPct: sum(humidity) / count,
        minSoilPct: Math.min(...soil),
        maxSoilPct: Math.max(...soil),
        avgSoilPct: sum(soil) / count
      };
    });
};
