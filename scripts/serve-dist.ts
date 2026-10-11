/**
 * Servidor estático do build, imitando o GitHub Pages: serve dist/ em
 * /site_bezalel/, com gzip (como o Pages) e 404.html para rotas inexistentes.
 * Usado pelo Lighthouse CI — o `vite preview` não comprime, o que distorceria
 * as medidas de carregamento.
 *
 * Uso: node scripts/serve-dist.ts [porta]
 */
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.argv[2] ?? 4173);
const BASE = '/site_bezalel/';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = /text|javascript|json|svg|xml|manifest/;

async function resolveFile(pathname: string): Promise<{ file: string; status: number }> {
  const rel = decodeURIComponent(pathname.slice(BASE.length));
  const file = normalize(join(root, rel));
  if (!file.startsWith(root + sep) && file !== root) return { file: join(root, '404.html'), status: 404 };
  try {
    const info = await stat(file);
    return { file: info.isDirectory() ? join(file, 'index.html') : file, status: 200 };
  } catch {
    return { file: join(root, '404.html'), status: 404 };
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { location: BASE }).end();
    return;
  }
  const { file, status } = await resolveFile(url.pathname);
  try {
    const body = await readFile(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const gzip = COMPRESSIBLE.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(status, { 'content-type': type, 'cache-control': 'max-age=600', ...(gzip ? { 'content-encoding': 'gzip' } : {}) });
    res.end(gzip ? gzipSync(body) : body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`serve-dist: http://localhost:${port}${BASE}`));
