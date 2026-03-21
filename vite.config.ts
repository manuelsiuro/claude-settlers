import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import os from 'node:os';

function getNetworkUrl(port: number): string {
  const interfaces = os.networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return `http://${addr.address}:${port}/`;
      }
    }
  }
  return '';
}

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
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
  },
}));
