import { FormEvent, useState } from "react";
import { ArrowUpRight, LogIn, LogOut, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useConnectionState } from "../hooks/useConnectionState";
import { useSettings } from "../hooks/useSettings";
import { useToast } from "../hooks/useToast";
import { firebaseService } from "../services/firebase";

export const SettingsPage = () => {
  const { settings, setDemoMode, setDemoConnected, setUnits, setThresholds, setFirebaseEnabled } = useSettings();
  const { user, flushPending } = useConnectionState();
  const { pushToast } = useToast();
  const firebaseAvailable = firebaseService.isEnabled();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submitSignIn = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const signedInUser = await firebaseService.signInEmail(email, password);
      if (!signedInUser) {
        pushToast("Firebase is not configured. Set VITE_FIREBASE_* variables first.", "warning");
        return;
      }
      pushToast("Signed in", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Sign-in failed", "error");
    }
  };

  const submitSignUp = async () => {
    try {
      const createdUser = await firebaseService.signUpEmail(email, password);
      if (!createdUser) {
        pushToast("Firebase is not configured. Set VITE_FIREBASE_* variables first.", "warning");
        return;
      }
      pushToast("Account created", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Sign-up failed", "error");
    }
  };

  const toggleDemo = (value: boolean) => {
    setDemoMode(value);
    pushToast(value ? "Demo mode enabled" : "BLE mode enabled", "info");
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Application</h2>

        <label className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
          Demo Mode
          <input
            type="checkbox"
            checked={settings.demoMode}
            onChange={(event) => toggleDemo(event.target.checked)}
            className="h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
          Simulate Device Connected
          <input
            type="checkbox"
            checked={settings.demoConnected}
            onChange={(event) => setDemoConnected(event.target.checked)}
            className="h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm">
          Enable Firebase
          <input
            type="checkbox"
            checked={settings.firebaseEnabled}
            onChange={(event) => setFirebaseEnabled(event.target.checked)}
            className="h-4 w-4"
            disabled={!firebaseAvailable}
          />
        </label>
        {!firebaseAvailable && (
          <p className="text-xs text-slate-500">
            Firebase is currently unavailable. Configure all <code>VITE_FIREBASE_*</code> values in <code>.env</code>.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Temperature units</span>
            <select
              value={settings.units}
              onChange={(event) => setUnits(event.target.value as "C" | "F")}
              className="w-full rounded-lg border border-border px-3 py-2"
            >
              <option value="C">Celsius (°C)</option>
              <option value="F">Fahrenheit (°F)</option>
            </select>
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Thresholds</h3>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Temp High (°C)
            <input
              type="number"
              value={settings.thresholds.temperatureHighC}
              onChange={(event) =>
                setThresholds({
                  ...settings.thresholds,
                  temperatureHighC: Number(event.target.value)
                })
              }
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Humidity Low (%)
            <input
              type="number"
              value={settings.thresholds.humidityLowPct}
              onChange={(event) =>
                setThresholds({
                  ...settings.thresholds,
                  humidityLowPct: Number(event.target.value)
                })
              }
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Soil Low (%)
            <input
              type="number"
              value={settings.thresholds.soilLowPct}
              onChange={(event) =>
                setThresholds({
                  ...settings.thresholds,
                  soilLowPct: Number(event.target.value)
                })
              }
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
        </div>

        <Button variant="secondary" onClick={flushPending} className="inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Sync Pending Queue
        </Button>

        <Link
          to="/test-run"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Open Test Run Page
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Firebase Auth</h3>

        <p className="text-sm text-slate-600">
          Current user: <span className="font-medium text-slate-900">{user?.email ?? user?.uid ?? "None"}</span>
        </p>

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitSignIn}>
          <label className="text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              autoComplete="email"
            />
          </label>
          <label className="text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              autoComplete="current-password"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" className="inline-flex items-center gap-2" disabled={!firebaseAvailable}>
              <LogIn className="h-4 w-4" /> Login
            </Button>
            <Button type="button" variant="secondary" onClick={submitSignUp} disabled={!firebaseAvailable}>
              Create Account
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!firebaseAvailable}
              onClick={() => {
                void firebaseService
                  .signInDemo()
                  .then((demoUser) => {
                    if (!demoUser) {
                      pushToast(
                        "Firebase is not configured. Set VITE_FIREBASE_* variables first.",
                        "warning"
                      );
                    }
                  })
                  .catch((error) => {
                    pushToast(error instanceof Error ? error.message : "Demo sign-in failed", "error");
                  });
              }}
            >
              Anonymous Demo Login
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!firebaseAvailable}
              onClick={() => {
                firebaseService.logout().then(() => pushToast("Logged out", "info"));
              }}
              className="inline-flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </form>

        <a
          href="https://capacitorjs.com/docs/apis/bluetooth-le"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
        >
          iPhone native bridge option (Capacitor BLE)
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </Card>
    </div>
  );
};
