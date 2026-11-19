// Storage and helpers shared by the API routes.
// Production: one private Vercel Blob document. Local preview (no BLOB_READ_WRITE_TOKEN): .local-data/.
// Nothing here is ever committed: campaign data, budgets and brand contracts stay out of the public repo.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DOC = 'campaigns/latest.json';
const LOCAL = path.join(process.cwd(), '.local-data', 'campaigns.json');
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function readData() {
  try {
    if (useBlob()) {
      const { get } = await import('@vercel/blob');
      const r = await get(DOC, { access: 'private', useCache: false });
      if (!r || !r.stream) return empty();
      return JSON.parse(await new Response(r.stream).text());
    }
    return JSON.parse(await fs.readFile(LOCAL, 'utf8'));
  } catch { return empty(); }
}

export async function writeData(obj) {
  const body = JSON.stringify(obj);
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    await put(DOC, body, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
  } else {
    await fs.mkdir(path.dirname(LOCAL), { recursive: true });
    await fs.writeFile(LOCAL, body);
  }
}

const empty = () => ({ syncedAt: null, campaigns: [] });

const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
/** True when the request carries the token stored in env var `name`. */
export const hasToken = (req, header, name) => {
  const t = req.headers[header], want = process.env[name];
  return !!(want && t && same(t, want));
};

export function send(res, code, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(obj);
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
export const clean = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const DAY = 86400000;
export const dateOnly = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
export const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));

/** End date the team entered wins over the SideShift one. */
export const endOf = c => c.team?.endsAt || c.endsAt || null;

/** Fields anyone can see. No budget, contract, spend or creator names. */
export function publicView(c) {
  const target = c.team?.targetCreators ?? null;
  return {
    id: c.id, brand: c.brand, name: c.team?.displayName || c.name, type: c.type,
    platforms: c.platforms || [], startsAt: c.startsAt || null, endsAt: endOf(c),
    targetCreators: target, activeCreators: c.activeCreators ?? 0,
    spotsOpen: target == null ? null : Math.max(0, target - (c.activeCreators ?? 0)),
    joinUrl: c.team?.joinUrl || 'https://app.sideshift.app/campaigns',
  };
}
export { DAY };
