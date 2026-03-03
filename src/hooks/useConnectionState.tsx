import { User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { bleService } from "../services/ble";
import { DEFAULT_DEMO_DEVICE_ID, DemoDataGenerator } from "../services/demo";
import { firebaseService } from "../services/firebase";
import { ConnectionSnapshot, SensorReading } from "../types";
import { useSettings } from "./useSettings";
import { useToast } from "./useToast";

const MAX_READINGS = 800;

interface ConnectionStateValue {
  snapshot: ConnectionSnapshot;
  readings: SensorReading[];
  latestReading: SensorReading | null;
  isBleSupported: boolean;
  localOnly: boolean;
  user: User | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  clearReadings: () => void;
  logReading: (reading?: SensorReading | null) => Promise<{ synced: boolean }>;
  flushPending: () => Promise<void>;
}

const ConnectionStateContext = createContext<ConnectionStateValue | null>(null);

export const ConnectionStateProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings, setDemoConnected } = useSettings();
  const { pushToast } = useToast();

  const [bleSnapshot, setBleSnapshot] = useState<ConnectionSnapshot>(bleService.getSnapshot());
  const [demoLastPacketAt, setDemoLastPacketAt] = useState<number | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [user, setUser] = useState<User | null>(firebaseService.getCurrentUser());

  const demoGeneratorRef = useRef<DemoDataGenerator | null>(null);
  const previousStatus = useRef<string>(bleSnapshot.status);

  const pushReading = useCallback((reading: SensorReading) => {
    setReadings((current) => [reading, ...current].slice(0, MAX_READINGS));
  }, []);

  useEffect(() => {
    bleService.setCalibration(settings.soilCalibration);
  }, [settings.soilCalibration]);

  useEffect(() => {
    const unsubscribeConnection = bleService.onConnection((next) => {
      setBleSnapshot(next);
      const previous = previousStatus.current;
      if (previous !== "connected" && next.status === "connected") {
        pushToast(`Connected to ${next.device?.name ?? "ESP32"}`, "success");
      }
      if (previous === "connected" && next.status === "disconnected") {
        pushToast("Device disconnected", "warning");
      }
      if (next.status === "error" && next.error) {
        pushToast(next.error, "error");
      }
      previousStatus.current = next.status;
    });

    const unsubscribeReadings = bleService.onReading((reading) => {
      pushReading(reading);
    });

    return () => {
      unsubscribeConnection();
      unsubscribeReadings();
    };
  }, [pushReading, pushToast]);

  useEffect(() => {
    if (settings.demoMode) {
      demoGeneratorRef.current?.stop();
      demoGeneratorRef.current = new DemoDataGenerator({ soilCalibration: settings.soilCalibration });

      demoGeneratorRef.current.start({
        connected: settings.demoConnected,
        deviceId: DEFAULT_DEMO_DEVICE_ID,
        onReading: (reading) => {
          setDemoLastPacketAt(reading.timestamp);
          pushReading(reading);
        }
      });
      return;
    }

    demoGeneratorRef.current?.stop();
    demoGeneratorRef.current = null;
  }, [settings.demoConnected, settings.demoMode, settings.soilCalibration, pushReading]);

  useEffect(() => {
    const unsubscribe = firebaseService.onAuth(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!settings.firebaseEnabled || !firebaseService.isEnabled() || firebaseService.getCurrentUser()) {
      return;
    }

    firebaseService.signInDemo().catch(() => undefined);
  }, [settings.firebaseEnabled]);

  useEffect(() => {
    const handleOnline = () => {
      firebaseService.flushPending().then((result) => {
        if (result.synced > 0) {
          pushToast(`Synced ${result.synced} pending readings`, "success");
        }
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [pushToast]);

  const effectiveSnapshot: ConnectionSnapshot = useMemo(() => {
    if (!settings.demoMode) {
      return bleSnapshot;
    }

    return {
      status: settings.demoConnected ? "connected" : "disconnected",
      error: null,
      lastPacketAt: demoLastPacketAt,
      device: {
        id: DEFAULT_DEMO_DEVICE_ID,
        name: "Demo ESP32",
        firmwareVersion: "demo-1.0",
        lastPacketAt: demoLastPacketAt ?? undefined
      }
    };
  }, [bleSnapshot, demoLastPacketAt, settings.demoConnected, settings.demoMode]);

  const connect = useCallback(async () => {
    if (settings.demoMode) {
      setDemoConnected(true);
      pushToast("Demo device connected", "success");
      return;
    }
    await bleService.scanAndConnect();
  }, [settings.demoMode, pushToast, setDemoConnected]);

  const disconnect = useCallback(async () => {
    if (settings.demoMode) {
      setDemoConnected(false);
      pushToast("Demo device disconnected", "info");
      return;
    }
    await bleService.disconnect();
  }, [settings.demoMode, pushToast, setDemoConnected]);

  const reconnect = useCallback(async () => {
    if (settings.demoMode) {
      setDemoConnected(true);
      pushToast("Demo device reconnected", "success");
      return;
    }
    await bleService.reconnect();
  }, [settings.demoMode, pushToast, setDemoConnected]);

  const clearReadings = useCallback(() => {
    setReadings([]);
  }, []);

  const latestReading = readings[0] ?? null;

  const logReading = useCallback(
    async (reading?: SensorReading | null) => {
      const target = reading ?? latestReading;
      if (!target) {
        throw new Error("No reading available to log.");
      }

      const result = settings.firebaseEnabled
        ? await firebaseService.logReading(target)
        : await firebaseService.logReadingLocalOnly(target);
      if (result.synced) {
        pushToast("Reading synced", "success");
      } else {
        pushToast("Saved locally. Will sync when available.", "warning");
      }
      return result;
    },
    [latestReading, pushToast, settings.firebaseEnabled]
  );

  const flushPending = useCallback(async () => {
    if (!settings.firebaseEnabled) {
      pushToast("Firebase sync disabled in settings", "info");
      return;
    }
    const result = await firebaseService.flushPending();
    if (result.synced > 0) {
      pushToast(`Synced ${result.synced} readings`, "success");
      return;
    }
    if (result.failed > 0) {
      pushToast(`${result.failed} readings still pending`, "warning");
    }
  }, [pushToast, settings.firebaseEnabled]);

  const value = useMemo<ConnectionStateValue>(
    () => ({
      snapshot: effectiveSnapshot,
      readings,
      latestReading,
      isBleSupported: bleService.isSupported(),
      localOnly: !settings.firebaseEnabled || !firebaseService.isEnabled(),
      user,
      connect,
      disconnect,
      reconnect,
      clearReadings,
      logReading,
      flushPending
    }),
    [
      connect,
      disconnect,
      effectiveSnapshot,
      flushPending,
      latestReading,
      logReading,
      readings,
      reconnect,
      settings.firebaseEnabled,
      user
    ]
  );

  return <ConnectionStateContext.Provider value={value}>{children}</ConnectionStateContext.Provider>;
};

export const useConnectionState = (): ConnectionStateValue => {
  const context = useContext(ConnectionStateContext);
  if (!context) {
    throw new Error("useConnectionState must be used inside ConnectionStateProvider.");
  }
  return context;
};
