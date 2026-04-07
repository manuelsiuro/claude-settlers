import { defineConfig, type PluginOption } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import os from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';

function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return 'localhost';
}

function getNetworkUrl(port: number): string {
  const ip = getLanIp();
  return ip !== 'localhost' ? `http://${ip}:${port}/` : '';
}

/**
 * Vite plugin that auto-starts the multiplayer relay server during development.
 * Spawns `npx tsx server/index.ts` as a child process alongside the Vite dev server.
 */
function relayServerPlugin(): PluginOption {
  let relayProcess: ChildProcess | null = null;
  const RELAY_PORT = 9876;

  return {
    name: 'relay-server',
    configureServer(server) {
      // Spawn the relay server as a child process
      relayProcess = spawn('npx', ['tsx', 'server/index.ts', String(RELAY_PORT)], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      relayProcess.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) console.log(`  \x1b[36m[relay]\x1b[0m ${msg}`);
      });

      relayProcess.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) console.error(`  \x1b[31m[relay]\x1b[0m ${msg}`);
      });

      relayProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
          console.error(`  \x1b[31m[relay]\x1b[0m Relay server exited with code ${code}`);
        }
        relayProcess = null;
      });

      // Kill relay when dev server closes
      server.httpServer?.on('close', () => {
        if (relayProcess) { relayProcess.kill(); relayProcess = null; }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    ...(command === 'serve' ? [relayServerPlugin()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // use existing public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB for large GLB models
        runtimeCaching: [
          {
            urlPattern: /\.glb$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'glb-models',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Chrome 87+ supports optional chaining, nullish coalescing, and WebGL 2.
    // This ensures the bundle works on Android devices with slightly older WebViews.
    target: ['es2020', 'chrome87', 'safari14'],
  },
  server: {
    host: true,
  },
  define: {
    __NETWORK_URL__: JSON.stringify(
      command === 'serve' ? getNetworkUrl(5173) : ''
    ),
    __RELAY_WS_URL__: JSON.stringify(
      command === 'serve' ? `ws://${getLanIp()}:9876` : ''
    ),
  },
}));
