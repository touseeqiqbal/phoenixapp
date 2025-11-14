import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { webcrypto } from "node:crypto";
import * as nodeCrypto from "node:crypto";

if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

if (typeof (nodeCrypto as unknown as { getRandomValues?: unknown }).getRandomValues !== "function") {
  (nodeCrypto as unknown as { getRandomValues: typeof webcrypto.getRandomValues }).getRandomValues =
    webcrypto.getRandomValues.bind(webcrypto);
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
