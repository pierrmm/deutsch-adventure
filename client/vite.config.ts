import { networkInterfaces } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

function lanPlugin(): Plugin {
  return {
    name: 'lan-ip-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/lan', (_request: IncomingMessage, response: ServerResponse) => {
        const addresses = Object.values(networkInterfaces())
          .flatMap((items) => items ?? [])
          .filter((item) => item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'))
          .map((item) => item.address)
        response.setHeader('Content-Type', 'application/json')
        response.end(
          JSON.stringify({
            addresses,
            preferred:
              addresses.find((ip) => ip.startsWith('192.168.')) ??
              addresses.find((ip) => ip.startsWith('10.')) ??
              addresses.find((ip) => ip.startsWith('172.')) ??
              addresses[0] ??
              '',
          }),
        )
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), lanPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})


