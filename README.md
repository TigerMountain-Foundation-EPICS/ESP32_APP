# ESP32 Sensor Console (React + TypeScript + PWA)

Offline-first telemetry console for ESP32 sensor data with optional BLE + Firebase sync and an ONNX webcam crowd-detection page.

## What Works Now

- TypeScript typecheck passes: `npm run typecheck`
- Production build passes: `npm run build`
- Frontend routes compile and serve in Vite
- Device actions now handle runtime errors safely (no uncaught reconnect crash)
- Firebase auth UI no longer reports false success when Firebase is not configured

## Quick Frontend Trial (No Hardware, No Firebase)

Use this path to trial the UI immediately.

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open app:
   - `http://127.0.0.1:5173` (or the URL Vite prints)
4. Keep these defaults in **Settings**:
   - `Demo Mode = ON`
   - `Simulate Device Connected = ON`
   - `Enable Firebase = OFF`
5. Verify pages:
   - Dashboard: cards and quick health render with live demo values
   - Live: chart updates and `Log Reading` works
   - History: date filters, chart, table, and daily aggregates render
   - Device: connection status/calibration UI renders without crashing
   - Crowd AI: page loads and controls render
   - Settings: toggles/thresholds persist

## Optional Firebase Setup

Only do this if you want cloud sync/auth.

1. Copy env file:
   - `cp .env.example .env`
2. Fill every `VITE_FIREBASE_*` value in `.env`
3. Restart dev server after env changes
4. In app **Settings**, enable Firebase

If Firebase is not fully configured, Firebase controls are disabled and the app stays local-only.

## BLE Assumptions

- Service UUID: `12345678-1234-1234-1234-1234567890ab`
- Notify Characteristic UUID: `12345678-1234-1234-1234-1234567890ac`
- Optional Firmware Characteristic UUID: `12345678-1234-1234-1234-1234567890ad`
- Preferred payload (UTF-8 JSON):
  - `{"t":24.6,"h":51.2,"s":678,"bat":3.98,"ts":1700000000000}`
- Binary fallback payload:
  - `int16 temp*100`, `uint16 humidity*100`, `uint16 soilRaw`, `uint16 batteryMv`, `uint32 unixSeconds`

## Crowd Detection Setup (ONNX + Webcam)

1. Put model at `public/models/crowd-detection.onnx` or upload from Crowd AI page
2. Open **Crowd AI** tab
3. Click `Load ONNX Model`
4. Click `Start Real-Time Analysis`
5. Allow camera access

Notes:
- Runs fully in-browser via `onnxruntime-web`
- Expects YOLO-style output and counts `person` class (`classId = 0`)

## Scripts

- `npm run dev` - run local dev server
- `npm run typecheck` - TypeScript validation
- `npm run build` - production build
- `npm run preview` - preview production build

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Recharts
- TanStack Query
- Firebase (optional auth + Firestore)
- PWA via `vite-plugin-pwa`

## Local-Only Behavior

When Firebase is off or unavailable:

- App continues to work with demo/BLE data
- Readings are stored locally
- Pending cloud sync queue is retained for future sync when cloud becomes available

## iPhone Note

Web Bluetooth support on iOS is limited. For reliable iPhone BLE, package with Capacitor and use `@capacitor-community/bluetooth-le`.
