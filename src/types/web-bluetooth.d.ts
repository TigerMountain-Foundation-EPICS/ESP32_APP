/* Minimal declarations for environments where TS DOM libs omit Web Bluetooth types. */
type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;

interface BluetoothRequestDeviceOptions {
  filters?: Array<{ services?: Array<BluetoothServiceUUID> }>;
  optionalServices?: BluetoothServiceUUID[];
  acceptAllDevices?: boolean;
}

interface Bluetooth extends EventTarget {
  requestDevice(options?: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  value: DataView | null;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  readValue(): Promise<DataView>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(
    characteristic: BluetoothCharacteristicUUID
  ): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

declare interface Navigator {
  bluetooth: Bluetooth;
}
