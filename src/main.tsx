import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";
import { ConnectionStateProvider } from "./hooks/useConnectionState";
import { SettingsProvider } from "./hooks/useSettings";
import { ToastProvider } from "./hooks/useToast";
import { ToastViewport } from "./components/ui/ToastViewport";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false
    }
  }
});

registerSW({
  onNeedRefresh() {
    console.info("New app version available.");
  },
  onOfflineReady() {
    console.info("App ready for offline use.");
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ToastProvider>
          <ConnectionStateProvider>
            <BrowserRouter>
              <App />
              <ToastViewport />
            </BrowserRouter>
          </ConnectionStateProvider>
        </ToastProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
