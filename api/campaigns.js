// Public creator board: only campaigns the team switched on, only safe fields.
import { readData, publicView, send } from './_store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const d = await readData();
  const campaigns = (d.campaigns || []).filter(c => c.team?.showOnBoard && c.status === 'active').map(publicView);
  send(res, 200, { syncedAt: d.syncedAt, campaigns });
}
