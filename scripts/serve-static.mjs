// Minimal zero-dependency static file server for the built Trimly frontend.
// Serves artifacts/trimly/dist/public with SPA fallback to index.html so
// client-side routes resolve. Uses only Node built-ins — no Vite/Rollup, so it
// runs on any platform without the native build binaries.
//
// Usage: node scripts/serve-static.mjs [port]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'artifacts',
  'trimly',
  'dist',
  'public',
);

const port = Number(process.argv[2] ?? process.env.PORT ?? 5173);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

async function tryFile(path) {
  try {
    const info = await stat(path);
    if (info.isFile()) return await readFile(path);
  } catch {
    // fall through
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    // Strip leading slash and normalise to prevent path traversal.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(root, rel);

    // Directory or root → index.html
    if (url.pathname === '/' || url.pathname.endsWith('/')) {
      filePath = join(root, 'index.html');
    }

    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let body = await tryFile(filePath);

    // SPA fallback: unknown non-asset routes serve index.html.
    if (body === null) {
      body = await tryFile(join(root, 'index.html'));
      filePath = join(root, 'index.html');
    }

    if (body === null) {
      res.writeHead(404).end('Not found (is the app built? expected dist/public)');
      return;
    }

    const type = mime[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }).end(body);
  } catch (err) {
    res.writeHead(500).end(`Server error: ${err instanceof Error ? err.message : String(err)}`);
  }
});

server.listen(port, () => {
  console.log(`Serving ${root}`);
  console.log(`  ➜  Local: http://localhost:${port}/`);
});
