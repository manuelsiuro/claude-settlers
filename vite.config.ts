import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
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
  plugins: [tailwindcss()],
  server: {
    host: true,
  },
  define: {
    __NETWORK_URL__: JSON.stringify(
      command === 'serve' ? getNetworkUrl(5173) : ''
    ),
  },
}));
