import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Nunito"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Baloo 2"', '"Nunito"', "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        surface: "#f4eee2",
        border: "#d8cdb7",
        accent: "#6d8d42",
        "brand-navy": "#17386c",
        "brand-olive": "#6d8d42",
        "brand-orange": "#ef7c28",
        "brand-sage": "#76a8a2",
        "brand-cream": "#fff9ee",
        "brand-mist": "#f1ebde"
      },
      boxShadow: {
        card: "0 18px 34px rgba(18, 37, 70, 0.14)",
        float: "0 10px 22px rgba(18, 37, 70, 0.12)",
        shell: "0 24px 54px rgba(18, 37, 70, 0.24)"
      }
    }
  },
  plugins: []
};

export default config;
