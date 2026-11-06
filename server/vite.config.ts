import { networkInterfaces } from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { defineConfig } from "vite";
import { colyseus } from "colyseus/vite";
import tailwindcss from "../client/node_modules/@tailwindcss/vite/dist/index.mjs";

export default defineConfig(({ mode }) => ({
  root: mode === "client" ? process.cwd() : "../client",
  build: { outDir: "../server/dist/client", emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    configureServer(vite: ViteDevServer) {
      vite.middlewares.use("/api/lan", (_request: IncomingMessage, response: ServerResponse) => {
        const addresses = Object.values(networkInterfaces()).flatMap((items) => items ?? []).filter((item) => item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254.")).map((item) => item.address);
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ addresses, preferred: addresses.find((ip) => ip.startsWith("192.168.")) ?? addresses.find((ip) => ip.startsWith("10.")) ?? addresses.find((ip) => ip.startsWith("172.")) ?? addresses[0] ?? "" }));
      });
    },
  },
  plugins: [
    // The plugin declares a second build environment (dist/server), so every
    // `vite build` builds both halves. `--mode client` drops it when you only
    // want the static client — e.g. deploying it separately from the server.
    // That mode also swaps which .env.* file Vite loads: .env.client, not
    // .env.production. Only matters once you add a VITE_-prefixed var.
    ...(mode === "client" ? [] : [tailwindcss(), colyseus({ serverEntry: "../server/src/app.config.ts" })]),
  ],
}));
