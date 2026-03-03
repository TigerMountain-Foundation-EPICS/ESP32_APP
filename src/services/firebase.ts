import {
  User,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAuth
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { DailyAggregate, SensorReading } from "../types";
import { aggregateByDay } from "./demo";
import { storage } from "../utils/storage";

const LOCAL_READINGS_KEY = "sensor.local.readings.v1";
const LOCAL_PENDING_KEY = "sensor.local.pending.v1";
const LOCAL_SESSION_KEY = "sensor.local.session.v1";

const env = {
  enabled: import.meta.env.VITE_FIREBASE_ENABLED === "true",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseConfigured =
  env.enabled &&
  Boolean(
    env.apiKey && env.authDomain && env.projectId && env.storageBucket && env.messagingSenderId && env.appId
  );

const firebaseApp = firebaseConfigured
  ? initializeApp({
      apiKey: env.apiKey,
      authDomain: env.authDomain,
      projectId: env.projectId,
      storageBucket: env.storageBucket,
      messagingSenderId: env.messagingSenderId,
      appId: env.appId
    })
  : null;

const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

const makeSessionId = (): string => storage.get<string>(LOCAL_SESSION_KEY, crypto.randomUUID());

const readLocalReadings = (): SensorReading[] => storage.get<SensorReading[]>(LOCAL_READINGS_KEY, []);

const writeLocalReadings = (readings: SensorReading[]) => storage.set(LOCAL_READINGS_KEY, readings);

const readPending = (): SensorReading[] => storage.get<SensorReading[]>(LOCAL_PENDING_KEY, []);

const writePending = (readings: SensorReading[]) => storage.set(LOCAL_PENDING_KEY, readings);

const normalizeReading = (reading: SensorReading): SensorReading => ({
  ...reading,
  id: reading.id || crypto.randomUUID(),
  source: reading.source || "ble"
});

const dedupeAndSort = (readings: SensorReading[]): SensorReading[] => {
  const map = new Map<string, SensorReading>();
  readings.forEach((reading) => map.set(reading.id, reading));
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
};

const upsertLocalReading = (reading: SensorReading): void => {
  const current = readLocalReadings();
  const next = dedupeAndSort([normalizeReading(reading), ...current]).slice(0, 2000);
  writeLocalReadings(next);
};

const pushPending = (reading: SensorReading): void => {
  const queue = readPending();
  queue.push(normalizeReading(reading));
  writePending(queue);
};

const writeRemoteReading = async (reading: SensorReading, user: User | null): Promise<void> => {
  if (!db) {
    throw new Error("Firestore is unavailable.");
  }

  const ref = doc(db, `devices/${reading.deviceId}/readings/${reading.id}`);
  await setDoc(ref, {
    ...reading,
    sessionId: makeSessionId(),
    uid: user?.uid ?? null,
    createdAt: serverTimestamp()
  });

  const deviceRef = doc(db, `devices/${reading.deviceId}`);
  await setDoc(
    deviceRef,
    {
      id: reading.deviceId,
      lastSeen: reading.timestamp,
      source: reading.source,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  const sessionRef = doc(db, `sessions/${makeSessionId()}`);
  await setDoc(
    sessionRef,
    {
      id: makeSessionId(),
      uid: user?.uid ?? null,
      deviceId: reading.deviceId,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

const canSync = (): boolean => Boolean(firebaseConfigured && db && auth && navigator.onLine);

export const firebaseService = {
  isEnabled(): boolean {
    return firebaseConfigured;
  },

  isLocalOnly(): boolean {
    return !firebaseConfigured;
  },

  getCurrentUser(): User | null {
    return auth?.currentUser ?? null;
  },

  onAuth(listener: (user: User | null) => void): () => void {
    if (!auth) {
      listener(null);
      return () => undefined;
    }

    return onAuthStateChanged(auth, listener);
  },

  async signInDemo(): Promise<User | null> {
    if (!auth) {
      return null;
    }
    const credential = await signInAnonymously(auth);
    return credential.user;
  },

  async signInEmail(email: string, password: string): Promise<User | null> {
    if (!auth) {
      return null;
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  async signUpEmail(email: string, password: string): Promise<User | null> {
    if (!auth) {
      return null;
    }
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  async logout(): Promise<void> {
    if (auth) {
      await signOut(auth);
    }
  },

  async logReading(reading: SensorReading): Promise<{ synced: boolean }> {
    const normalized = normalizeReading(reading);
    upsertLocalReading(normalized);

    if (!canSync()) {
      pushPending(normalized);
      return { synced: false };
    }

    try {
      await writeRemoteReading(normalized, auth?.currentUser ?? null);
      return { synced: true };
    } catch {
      pushPending(normalized);
      return { synced: false };
    }
  },

  async logReadingLocalOnly(reading: SensorReading): Promise<{ synced: boolean }> {
    const normalized = normalizeReading(reading);
    upsertLocalReading(normalized);
    return { synced: false };
  },

  async flushPending(): Promise<{ synced: number; failed: number }> {
    if (!canSync()) {
      return { synced: 0, failed: readPending().length };
    }

    const queue = readPending();
    if (!queue.length) {
      return { synced: 0, failed: 0 };
    }

    const unsynced: SensorReading[] = [];
    let synced = 0;

    for (const item of queue) {
      try {
        await writeRemoteReading(item, auth?.currentUser ?? null);
        synced += 1;
      } catch {
        unsynced.push(item);
      }
    }

    writePending(unsynced);
    return { synced, failed: unsynced.length };
  },

  async getReadingsRange(options: {
    startTs: number;
    endTs: number;
    deviceId?: string;
    maxRows?: number;
  }): Promise<SensorReading[]> {
    const { startTs, endTs, deviceId, maxRows = 500 } = options;

    if (firebaseConfigured && db && navigator.onLine && deviceId) {
      try {
        const readingsRef = collection(db, `devices/${deviceId}/readings`);
        const q = query(
          readingsRef,
          where("timestamp", ">=", startTs),
          where("timestamp", "<=", endTs),
          orderBy("timestamp", "desc"),
          limit(maxRows)
        );

        const snapshot = await getDocs(q);
        const remote = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as SensorReading;
          return normalizeReading({ ...data, id: docSnap.id });
        });

        const merged = dedupeAndSort([...remote, ...readLocalReadings()]).filter(
          (reading) => reading.timestamp >= startTs && reading.timestamp <= endTs
        );
        writeLocalReadings(merged);
        return merged;
      } catch {
        // Fallback handled below.
      }
    }

    return dedupeAndSort(readLocalReadings())
      .filter((reading) => {
        if (deviceId && reading.deviceId !== deviceId) {
          return false;
        }
        return reading.timestamp >= startTs && reading.timestamp <= endTs;
      })
      .slice(0, maxRows);
  },

  async getDailyAggregates(options: {
    startDay: string;
    endDay: string;
    deviceId: string;
  }): Promise<DailyAggregate[]> {
    if (firebaseConfigured && db && navigator.onLine) {
      try {
        const ref = collection(db, `devices/${options.deviceId}/aggregates`);
        const q = query(ref, where("day", ">=", options.startDay), where("day", "<=", options.endDay));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<DailyAggregate, "id">) }))
            .sort((a, b) => (a.day < b.day ? -1 : 1));
        }
      } catch {
        // Fallback handled below.
      }
    }

    const startTs = new Date(`${options.startDay}T00:00:00`).getTime();
    const endTs = new Date(`${options.endDay}T23:59:59`).getTime();
    const readings = dedupeAndSort(readLocalReadings()).filter(
      (reading) =>
        reading.deviceId === options.deviceId &&
        reading.timestamp >= startTs &&
        reading.timestamp <= endTs
    );

    return aggregateByDay(readings);
  },

  async getDeviceMetadata(deviceId: string): Promise<Record<string, unknown> | null> {
    if (!db || !firebaseConfigured || !navigator.onLine) {
      return null;
    }

    try {
      const ref = doc(db, `devices/${deviceId}`);
      const snapshot = await getDoc(ref);
      return snapshot.exists() ? snapshot.data() : null;
    } catch {
      return null;
    }
  }
};

if (!storage.get<string | null>(LOCAL_SESSION_KEY, null)) {
  storage.set(LOCAL_SESSION_KEY, crypto.randomUUID());
}
