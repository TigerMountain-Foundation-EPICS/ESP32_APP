import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon-192.svg",
        "icons/icon-512.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "apple-touch-icon.png"
      ],
      manifest: {
        name: "ESP32 Sensor Console",
        short_name: "SensorConsole",
        description: "Minimal telemetry console for ESP32 BLE sensors",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        orientation: "portrait",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        navigateFallbackDenylist: [/^\/__/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "firestore-api",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173
  }
});
