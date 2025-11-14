/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#38bdf8",
          soft: "#0f172a"
        }
      },
      boxShadow: {
        elevated: "0 25px 50px -20px rgba(15, 23, 42, 0.45)"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
