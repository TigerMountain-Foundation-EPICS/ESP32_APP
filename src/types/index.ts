export type ReadingSource = "ble" | "demo";

export type ConnectionStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface SensorReading {
  id: string;
  timestamp: number;
  temperatureC: number;
  humidityPct: number;
  soilRawOrPct: number;
  soilPct: number;
  batteryV?: number;
  rssi?: number;
  deviceId: string;
  source: ReadingSource;
}

export interface DeviceMetadata {
  id: string;
  name: string;
  firmwareVersion?: string;
  rssi?: number;
  lastPacketAt?: number;
}

export interface ThresholdSettings {
  temperatureHighC: number;
  humidityLowPct: number;
  soilLowPct: number;
}

export interface SoilCalibration {
  min: number;
  max: number;
}

export interface AppSettings {
  demoMode: boolean;
  demoConnected: boolean;
  units: "C" | "F";
  thresholds: ThresholdSettings;
  soilCalibration: SoilCalibration;
  firebaseEnabled: boolean;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DailyAggregate {
  id: string;
  day: string;
  deviceId: string;
  count: number;
  minTemperatureC: number;
  maxTemperatureC: number;
  avgTemperatureC: number;
  minHumidityPct: number;
  maxHumidityPct: number;
  avgHumidityPct: number;
  minSoilPct: number;
  maxSoilPct: number;
  avgSoilPct: number;
}

export interface BlePayload {
  t: number;
  h: number;
  s: number;
  bat?: number;
  ts?: number;
}

export interface BleParsedPacket {
  reading: SensorReading;
  rawText?: string;
}

export interface ConnectionSnapshot {
  status: ConnectionStatus;
  device: DeviceMetadata | null;
  lastPacketAt: number | null;
  error: string | null;
}
