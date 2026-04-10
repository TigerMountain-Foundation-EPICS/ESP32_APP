import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LoadingSkeleton } from "./components/ui/LoadingSkeleton";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const LivePage = lazy(() => import("./pages/LivePage").then((module) => ({ default: module.LivePage })));
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage }))
);
const DevicePage = lazy(() =>
  import("./pages/DevicePage").then((module) => ({ default: module.DevicePage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);
const TestRunPage = lazy(() =>
  import("./pages/TestRunPage").then((module) => ({ default: module.TestRunPage }))
);

export const App = () => (
  <AppShell>
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/device" element={<DevicePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/test-run" element={<TestRunPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </AppShell>
);
