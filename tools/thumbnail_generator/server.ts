/**
 * Simple HTTP server for the thumbnail generator tool.
 * Serves the HTML tool, data JSON, and model files.
 * Receives rendered PNGs via POST and writes them to disk.
 *
 * Zero dependencies — uses only Node.js built-in modules.
 * Run: npm run thumbnail-tool
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const PORT = 3001;

// MIME types for served files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};

// Ensure output directories exist
const OUTPUT_BASE = resolve(PROJECT_ROOT, 'public', 'thumbnails');
for (const sub of ['buildings', 'units', 'resources']) {
  const dir = resolve(OUTPUT_BASE, sub);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created ${dir}`);
  }
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';

  // ── POST: Save thumbnail ──────────────────────────────────────
  if (method === 'POST' && url === '/save-thumbnail') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { category, filename, data } = JSON.parse(body);
        if (!category || !filename || !data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing category, filename, or data' }));
          return;
        }

        const outDir = resolve(OUTPUT_BASE, category);
        if (!existsSync(outDir)) {
          mkdirSync(outDir, { recursive: true });
        }

        const filePath = resolve(outDir, filename);
        // data is base64-encoded PNG (may have data URI prefix)
        const base64 = data.replace(/^data:image\/png;base64,/, '');
        writeFileSync(filePath, Buffer.from(base64, 'base64'));

        console.log(`  Saved: ${category}/${filename}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: `${category}/${filename}` }));
      } catch (err) {
        console.error('Save error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // ── POST: All complete signal ─────────────────────────────────
  if (method === 'POST' && url === '/save-all-complete') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { total, saved, failed } = JSON.parse(body);
        console.log(`\nAll thumbnails complete: ${saved} saved, ${failed} failed out of ${total} total`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }
    });
    return;
  }

  // ── GET: Serve static files ───────────────────────────────────
  if (method !== 'GET') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  // Map URL paths to filesystem
  let filePath: string;
  if (url === '/' || url === '/index.html') {
    filePath = resolve(__dirname, 'index.html');
  } else if (url === '/thumbnail-data.json') {
    filePath = resolve(__dirname, 'thumbnail-data.json');
  } else if (url!.startsWith('/models/')) {
    // Serve model files from public/models/
    filePath = resolve(PROJECT_ROOT, 'public', url!.slice(1));
  } else if (url!.startsWith('/tools/')) {
    // Serve tool files relative to project root
    filePath = resolve(PROJECT_ROOT, url!.slice(1));
  } else {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Thumbnail Generator Server running on http://localhost:${PORT}`);
  console.log(`Open: http://localhost:${PORT}/index.html`);
  console.log(`\nOutput directory: ${OUTPUT_BASE}`);
  console.log('Waiting for thumbnail saves...\n');
});
