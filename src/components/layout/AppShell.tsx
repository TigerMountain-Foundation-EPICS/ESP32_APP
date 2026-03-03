import { Bluetooth, Gauge, History, LayoutDashboard, Settings, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useConnectionState } from "../../hooks/useConnectionState";
import { StatusPill } from "../ui/StatusPill";

const tabs = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live", label: "Live", icon: Gauge },
  { to: "/history", label: "History", icon: History },
  { to: "/device", label: "Device", icon: Bluetooth },
  { to: "/crowd", label: "Crowd AI", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings }
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { snapshot, localOnly } = useConnectionState();

  return (
    <div className="min-h-screen bg-surface text-slate-900">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">ESP32 Sensor Console</h1>
            <p className="text-xs text-slate-500">Minimal telemetry, offline-first</p>
          </div>
          <div className="flex items-center gap-2">
            {localOnly && (
              <span className="rounded-full border border-border bg-slate-100 px-2 py-1 text-xs text-slate-700">
                Local only
              </span>
            )}
            <StatusPill status={snapshot.status} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2" aria-label="Main tabs">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-w-fit items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-accent text-white" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 pb-10">{children}</main>
    </div>
  );
};
