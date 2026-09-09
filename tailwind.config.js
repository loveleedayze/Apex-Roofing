/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette: deep slate + high-energy amber CTA.
        brand: {
          navy: "#0b1b2b",
          slate: "#13293d",
          steel: "#1c3a52",
          accent: "#f97316", // orange-500 — primary CTA
          accentDark: "#ea580c",
          gold: "#fbbf24",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        cta: "0 8px 24px -6px rgba(249, 115, 22, 0.5)",
        card: "0 10px 40px -12px rgba(11, 27, 43, 0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.1)", opacity: "0" },
          "100%": { opacity: "0" },
        },
        // Demo mode: a lead row landing in the pipeline mid-presentation.
        "flash-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(-8px) scale(0.97)",
            boxShadow: "0 0 0 0 rgba(249, 115, 22, 0.6)",
          },
          "40%": {
            opacity: "1",
            transform: "translateY(0) scale(1)",
            boxShadow: "0 0 0 8px rgba(249, 115, 22, 0.25)",
          },
          "70%": { boxShadow: "0 0 0 4px rgba(249, 115, 22, 0.35)" },
          "100%": { boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "pulse-ring": "pulse-ring 2s infinite",
        "flash-in": "flash-in 2.4s ease-out both",
      },
    },
  },
  plugins: [],
};
