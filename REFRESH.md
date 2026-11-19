# Campaign sync

Pulls campaigns and creator counts from SideShift with the SideShift connector (read only) and pushes them to the dashboard. It never changes anything in SideShift. Team-entered fields (target, budget, end date, contract, board toggle) are kept across syncs.

Write the working JSON to a temp folder. Never commit it.

## 1. Campaigns

Set the company ids you want on the dashboard, then run with `postgres_query`:

```sql
select company_id, company_name, id, name, campaign_type, status, starts_at, ends_at,
       requirements->'platforms' as platforms
from campaigns
where company_id in (/* company ids */)
  and status = 'active' and archived_at is null
  and not analytics_only and not is_ghost
  and campaign_type in ('ugc', 'influencer')
order by company_name, name;
```

Manager campaigns (`campaign-manager`), paid ads and analytics-only campaigns are left out on purpose.

## 2. Creator counts

```sql
select campaign_id,
       count(*) filter (where status = 'active')  as active,
       count(*) filter (where status = 'pending') as pending
from contracts
where campaign_id in (/* ids from step 1 */)
group by 1;
```

A campaign with no rows has 0 active and 0 pending.

## 3. Push

Build this shape (dates as `YYYY-MM-DD`):

```json
{ "campaigns": [
  { "id": "...", "companyId": "...", "brand": "...", "name": "...", "type": "ugc",
    "status": "active", "startsAt": "2026-11-01", "endsAt": null,
    "platforms": ["tiktok", "instagram"], "activeCreators": 20, "pendingCreators": 0 }
] }
```

```bash
curl -sS -X POST "$SITE/api/team" -H "x-sync-token: $SYNC_TOKEN" -H 'content-type: application/json' --data @sync.json
```

A campaign missing from a push drops off the dashboard. Its team fields are kept, and come back if it shows up in a later push.
