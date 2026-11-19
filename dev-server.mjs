// Local preview: serves the page and runs the /api routes against .local-data/ (gitignored).
// Usage: node dev-server.mjs  (port 3010). Tokens come from env, or are generated once into .local-data/tokens.json.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.dirname(new URL(import.meta.url).pathname);
process.chdir(root);
const tokFile = path.join(root, '.local-data', 'tokens.json');
let toks = {};
try { toks = JSON.parse(await fs.readFile(tokFile, 'utf8')); } catch {
  toks = { TEAM_TOKEN: crypto.randomBytes(12).toString('hex'), SYNC_TOKEN: crypto.randomBytes(12).toString('hex') };
  await fs.mkdir(path.dirname(tokFile), { recursive: true });
  await fs.writeFile(tokFile, JSON.stringify(toks, null, 2));
}
process.env.TEAM_TOKEN ||= toks.TEAM_TOKEN;
process.env.SYNC_TOKEN ||= toks.SYNC_TOKEN;
delete process.env.BLOB_READ_WRITE_TOKEN; // always use the local folder here

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 3010;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
    let mod;
    // Fresh copy on every request so edits show up without a restart.
    try { mod = await import(path.join(root, 'api', name + '.js') + '?t=' + Date.now()); } catch { res.writeHead(404); return res.end('{}'); }
    let raw = ''; for await (const ch of req) raw += ch;
    req.body = raw;
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    return mod.default(req, res);
  }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(root) || file.includes(`${path.sep}.`) || file.includes(`${path.sep}api${path.sep}`)) { res.writeHead(404); return res.end(); }
  try { const b = await fs.readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, () => console.log(`Open Campaigns preview on http://localhost:${port}  (tokens in .local-data/tokens.json)`));
