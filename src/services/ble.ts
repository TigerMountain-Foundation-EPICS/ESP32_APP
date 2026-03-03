import { ConnectionSnapshot, ConnectionStatus, DeviceMetadata, SensorReading, SoilCalibration } from "../types";
import { clamp } from "../utils/math";

export const BLE_SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
export const BLE_NOTIFY_CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890ac";
export const BLE_FIRMWARE_CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890ad";

const BATTERY_SERVICE_UUID = 0x180f;
const BATTERY_CHARACTERISTIC_UUID = 0x2a19;
const decoder = new TextDecoder();

const toSoilPercent = (raw: number, calibration: SoilCalibration): number => {
  const span = Math.max(1, calibration.max - calibration.min);
  const normalized = (raw - calibration.min) / span;
  return clamp((1 - normalized) * 100, 0, 100);
};

type ReadingListener = (reading: SensorReading) => void;
type ConnectionListener = (snapshot: ConnectionSnapshot) => void;

export class BleService {
  private device: BluetoothDevice | null = null;

  private server: BluetoothRemoteGATTServer | null = null;

  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private firmware: string | undefined;

  private batteryLevel: number | undefined;

  private status: ConnectionStatus = "idle";

  private lastPacketAt: number | null = null;

  private error: string | null = null;

  private reconnectAttempts = 0;

  private reconnectTimer: number | null = null;

  private maxReconnectAttempts = 6;

  private manualDisconnect = false;

  private calibration: SoilCalibration = { min: 1200, max: 3200 };

  private readingListeners = new Set<ReadingListener>();

  private connectionListeners = new Set<ConnectionListener>();

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  setCalibration(calibration: SoilCalibration): void {
    this.calibration = calibration;
  }

  onReading(listener: ReadingListener): () => void {
    this.readingListeners.add(listener);
    return () => this.readingListeners.delete(listener);
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.getSnapshot());
    return () => this.connectionListeners.delete(listener);
  }

  getSnapshot(): ConnectionSnapshot {
    return {
      status: this.status,
      device: this.device
        ? {
            id: this.device.id || "unknown",
            name: this.device.name || "ESP32 Sensor",
            firmwareVersion: this.firmware,
            lastPacketAt: this.lastPacketAt ?? undefined,
            rssi: undefined
          }
        : null,
      lastPacketAt: this.lastPacketAt,
      error: this.error
    };
  }

  async scanAndConnect(): Promise<void> {
    if (!this.isSupported()) {
      this.setState("error", "Web Bluetooth is not supported in this browser.");
      return;
    }

    this.manualDisconnect = false;
    this.setState("scanning");

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
        optionalServices: [BLE_SERVICE_UUID, BATTERY_SERVICE_UUID]
      });

      await this.connect(device);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BLE scan cancelled";
      this.setState("disconnected", message);
    }
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();

    if (this.notifyCharacteristic) {
      this.notifyCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        this.handleCharacteristicChange as EventListener
      );
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.notifyCharacteristic = null;
    this.server = null;
    this.setState("disconnected");
  }

  async reconnect(): Promise<void> {
    if (!this.device) {
      throw new Error("No previously connected device.");
    }
    this.manualDisconnect = false;
    await this.connect(this.device, true);
  }

  private async connect(device: BluetoothDevice, isReconnect = false): Promise<void> {
    this.device = device;
    this.device.removeEventListener("gattserverdisconnected", this.handleDisconnect as EventListener);
    this.device.addEventListener("gattserverdisconnected", this.handleDisconnect as EventListener);

    this.setState(isReconnect ? "reconnecting" : "connecting");

    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("Failed to open GATT server.");
    }
    this.server = server;

    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(BLE_NOTIFY_CHARACTERISTIC_UUID);
    await characteristic.startNotifications();
    characteristic.addEventListener(
      "characteristicvaluechanged",
      this.handleCharacteristicChange as EventListener
    );

    this.notifyCharacteristic = characteristic;
    this.firmware = await this.readFirmwareVersion(service);
    this.batteryLevel = await this.readBatteryLevel(server);

    this.reconnectAttempts = 0;
    this.error = null;
    this.setState("connected");
  }

  private handleCharacteristicChange = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) {
      return;
    }

    const parsed = this.parsePayload(target.value);
    if (!parsed) {
      return;
    }

    this.lastPacketAt = parsed.timestamp;

    const reading: SensorReading = {
      id: crypto.randomUUID(),
      timestamp: parsed.timestamp,
      temperatureC: parsed.temperatureC,
      humidityPct: parsed.humidityPct,
      soilRawOrPct: parsed.soilRaw,
      soilPct: parsed.soilPct,
      batteryV: parsed.batteryV,
      deviceId: this.device?.id || "esp32",
      source: "ble",
      rssi: undefined
    };

    this.readingListeners.forEach((listener) => listener(reading));
    this.notifyConnectionListeners();
  };

  private parsePayload(value: DataView): {
    timestamp: number;
    temperatureC: number;
    humidityPct: number;
    soilRaw: number;
    soilPct: number;
    batteryV?: number;
  } | null {
    const uint8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

    try {
      const text = decoder.decode(uint8).trim().replace(/\0+$/g, "");
      if (text.startsWith("{")) {
        const parsed = JSON.parse(text) as {
          t?: number;
          h?: number;
          s?: number;
          bat?: number;
          ts?: number;
          temperatureC?: number;
          humidityPct?: number;
          soil?: number;
        };

        const temperatureC = Number(parsed.t ?? parsed.temperatureC);
        const humidityPct = Number(parsed.h ?? parsed.humidityPct);
        const soilRaw = Number(parsed.s ?? parsed.soil);

        if ([temperatureC, humidityPct, soilRaw].some((item) => Number.isNaN(item))) {
          return null;
        }

        return {
          timestamp: Number(parsed.ts ?? Date.now()),
          temperatureC,
          humidityPct,
          soilRaw,
          soilPct: Number(toSoilPercent(soilRaw, this.calibration).toFixed(2)),
          batteryV: parsed.bat
        };
      }
    } catch {
      // Binary fallback is handled below.
    }

    if (uint8.byteLength < 12) {
      return null;
    }

    const dv = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    const temperatureC = dv.getInt16(0, true) / 100;
    const humidityPct = dv.getUint16(2, true) / 100;
    const soilRaw = dv.getUint16(4, true);
    const batteryMv = dv.getUint16(6, true);
    const timestamp = dv.getUint32(8, true) * 1000;

    return {
      timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      temperatureC,
      humidityPct,
      soilRaw,
      soilPct: Number(toSoilPercent(soilRaw, this.calibration).toFixed(2)),
      batteryV: Number((batteryMv / 1000).toFixed(2))
    };
  }

  private handleDisconnect = (): void => {
    if (this.manualDisconnect) {
      return;
    }

    this.server = null;
    this.notifyCharacteristic = null;
    this.tryReconnect();
  };

  private async tryReconnect(): Promise<void> {
    if (!this.device) {
      this.setState("disconnected", "Device disconnected.");
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState("error", "Unable to reconnect to BLE device.");
      return;
    }

    this.setState("reconnecting", `Reconnecting (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    const delay = Math.min(16000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.clearReconnectTimer();

    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await this.connect(this.device as BluetoothDevice, true);
      } catch {
        await this.tryReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async readFirmwareVersion(service: BluetoothRemoteGATTService): Promise<string | undefined> {
    try {
      const characteristic = await service.getCharacteristic(BLE_FIRMWARE_CHARACTERISTIC_UUID);
      const value = await characteristic.readValue();
      return decoder.decode(value).trim();
    } catch {
      return undefined;
    }
  }

  private async readBatteryLevel(server: BluetoothRemoteGATTServer): Promise<number | undefined> {
    try {
      const service = await server.getPrimaryService(BATTERY_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(BATTERY_CHARACTERISTIC_UUID);
      const value = await characteristic.readValue();
      return value.getUint8(0);
    } catch {
      return undefined;
    }
  }

  private setState(status: ConnectionStatus, error: string | null = null): void {
    this.status = status;
    this.error = error;
    this.notifyConnectionListeners();
  }

  private notifyConnectionListeners(): void {
    const snapshot: ConnectionSnapshot = {
      status: this.status,
      device: this.device
        ? {
            id: this.device.id || "esp32",
            name: this.device.name || "ESP32 Sensor",
            firmwareVersion: this.firmware,
            rssi: undefined,
            lastPacketAt: this.lastPacketAt ?? undefined
          }
        : null,
      lastPacketAt: this.lastPacketAt,
      error: this.error
    };

    this.connectionListeners.forEach((listener) => listener(snapshot));
  }
}

export const bleService = new BleService();
