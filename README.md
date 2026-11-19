# Open Campaigns

A two-tab dashboard for SideShift campaigns, built in the SideShift Liquid Metal design (`liquid-metal.css`).

- **Creators** (public): campaigns the team has switched on, with open spots, how long each campaign has run, a countdown to its end date, platforms and an Apply button.
- **Team** (needs the team token): every synced campaign with active and pending creators, the creator target and open spots, days running, a live countdown, budget and spend, and the brand contract (status, signed date, term, signer, link). Each row has an Edit button.

**This repo is public, so it holds code only.** Campaign data, budgets and brand contracts live in a private Vercel Blob document (`campaigns/latest.json`), never in git. The public API returns only brand, campaign name, type, platforms, dates, creator target, active creators and open spots.

## Where each number comes from

| Field | Source |
| --- | --- |
| Brand, campaign, type, platforms, start date | SideShift sync (`campaigns` table) |
| Active and pending creators | SideShift sync (`contracts` by status) |
| Running for | Today minus the start date |
| Creators wanted, open spots | Team enters the target; open spots = target − active |
| End date, time left | Team enters it (SideShift's end date is blank on current campaigns) |
| Budget, spent | Team enters them |
| Brand contract | Team enters it (SideShift only stores creator contracts) |
| Shown on creator board | Team toggles it per campaign; off by default |

## Deploy (Vercel)

1. Import this repo into Vercel and add a Blob store to the project (this sets `BLOB_READ_WRITE_TOKEN`).
2. Set two env vars to long random strings: `TEAM_TOKEN` (people type this to open the Team tab) and `SYNC_TOKEN` (used only by the sync job).
3. Run the sync in [REFRESH.md](REFRESH.md) to load campaigns, then open the Team tab and fill in targets, end dates, budgets and contracts.

## Local preview

```bash
node dev-server.mjs
```

Opens on `http://localhost:3010`. It stores data in `.local-data/` (gitignored) and generates tokens into `.local-data/tokens.json`.

## API

- `GET /api/campaigns`: public board data.
- `GET /api/team` with `x-team-token`: everything.
- `PATCH /api/team` with `x-team-token`, body `{ id, team: {...} }`: save the team fields for one campaign.
- `POST /api/team` with `x-sync-token`, body `{ campaigns: [...] }`: replace synced fields. Team-entered fields are kept.
