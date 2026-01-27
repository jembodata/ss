/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2937",
        muted: "#6b7280",
        accent: "#0f766e",
        card: "#fffdf7",
        sand: "#f5f0e6"
      }
    }
  },
  plugins: []
};
