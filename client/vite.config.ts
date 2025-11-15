import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nodeCrypto = require("node:crypto");

if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

if (typeof nodeCrypto.getRandomValues !== "function") {
  nodeCrypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
