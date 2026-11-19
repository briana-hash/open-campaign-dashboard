// Team view. Everything here needs a token; nothing is stored in the repo.
//   GET   x-team-token  -> every synced campaign with the team's fields (budget, target, contract...)
//   PATCH x-team-token  -> { id, team: {...} } saves the team-entered fields for one campaign
//   POST  x-sync-token  -> { campaigns: [...] } the SideShift sync replaces the auto fields, keeps team fields
import { readData, writeData, hasToken, send, readBody, clean, dateOnly, num } from './_store.js';

const CONTRACT = ['signed', 'sent', 'negotiating', 'none'];

function teamFields(t = {}) {
  return {
    displayName: clean(t.displayName, 80) || null,
    showOnBoard: !!t.showOnBoard,
    targetCreators: num(t.targetCreators),
    budget: num(t.budget),
    spent: num(t.spent),
    endsAt: dateOnly(t.endsAt),
    joinUrl: /^https:\/\//.test(t.joinUrl || '') ? clean(t.joinUrl, 300) : null,
    contract: {
      status: CONTRACT.includes(t.contract?.status) ? t.contract.status : 'none',
      signedAt: dateOnly(t.contract?.signedAt),
      termMonths: num(t.contract?.termMonths),
      signer: clean(t.contract?.signer, 80) || null,
      url: /^https:\/\//.test(t.contract?.url || '') ? clean(t.contract.url, 500) : null,
    },
    notes: clean(t.notes, 500) || null,
  };
}

function syncedFields(c) {
  return {
    id: clean(c.id, 40), brand: clean(c.brand, 80), companyId: clean(c.companyId, 40) || null,
    name: clean(c.name, 120), type: clean(c.type, 20), status: clean(c.status, 20) || 'active',
    platforms: Array.isArray(c.platforms) ? c.platforms.map(p => clean(p, 20)).slice(0, 8) : [],
    startsAt: dateOnly(c.startsAt), endsAt: dateOnly(c.endsAt),
    activeCreators: num(c.activeCreators) ?? 0, pendingCreators: num(c.pendingCreators) ?? 0,
  };
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    if (!hasToken(req, 'x-sync-token', 'SYNC_TOKEN')) return send(res, 401, { error: 'Bad sync token.' });
    const b = await readBody(req);
    if (!Array.isArray(b.campaigns)) return send(res, 400, { error: 'Expected { campaigns: [...] }.' });
    const prev = await readData();
    // Team fields survive a campaign dropping out of a sync, so budgets and contracts are never lost.
    const keep = new Map(Object.entries(prev.retired || {}));
    (prev.campaigns || []).forEach(c => keep.set(c.id, c.team));
    const campaigns = b.campaigns.slice(0, 500).map(syncedFields).filter(c => c.id)
      .map(c => ({ ...c, team: keep.get(c.id) || teamFields({}) }));
    campaigns.forEach(c => keep.delete(c.id));
    await writeData({ syncedAt: new Date().toISOString(), campaigns, retired: Object.fromEntries(keep) });
    return send(res, 200, { ok: true, campaigns: campaigns.length });
  }

  if (!hasToken(req, 'x-team-token', 'TEAM_TOKEN')) return send(res, 401, { error: 'Team token needed.' });

  if (req.method === 'GET') return send(res, 200, await readData());

  if (req.method === 'PATCH') {
    const b = await readBody(req);
    const d = await readData();
    const c = (d.campaigns || []).find(x => x.id === b.id);
    if (!c) return send(res, 404, { error: 'No campaign with that id.' });
    c.team = teamFields(b.team);
    c.team.updatedAt = new Date().toISOString();
    await writeData(d);
    return send(res, 200, { ok: true, campaign: c });
  }
  send(res, 405, { error: 'Method not allowed' });
}
