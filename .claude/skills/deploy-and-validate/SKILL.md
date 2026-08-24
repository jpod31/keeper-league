---
name: deploy-and-validate
description: Build, commit, push and deploy Keeper League to keeperlg.com, then validate the deploy — SPA rebuild rules, the server update script, the pytest baseline, offline DB simulation with WAL files, the puppeteer visual harness, and the 404-serves-200 endpoint trap. Use when deploying Keeper League, verifying a change is live, or checking whether work is safe to declare done.
---

# Deploy + validate (Keeper League)

**Deploying is expected after every change** — the owner wants work live
immediately. The flow is always: build (if frontend changed) → commit → push →
run the server update script.

```
# 1. If frontend/src changed, rebuild the SPA bundle (CSS-only changes DON'T need this):
cd frontend && npm run build        # tsc -b && vite build → outputs to ../static/spa/

# 2. Commit + push (main branch, remote: origin → github.com/jpod31/keeper-league)
git add <files> && git commit -m "..." && git push origin HEAD

# 3. Deploy to prod (pulls, installs deps, restarts gunicorn, confirms running)
ssh root@43.224.183.136 'bash /opt/keeper-league/scripts/update_server.sh'
```

- **Server**: `root@43.224.183.136`, app at `/opt/keeper-league`, service
  `keeper-league` (gunicorn+eventlet behind nginx). Logs:
  `journalctl -u keeper-league -f`.
- **CSV/XLSX data is gitignored** — upload separately via `scp` to
  `/opt/keeper-league/data/` then `chown keeper:keeper`. Ratings XLSX path is in
  server `.env` (`RATINGS_XLSX_PATH`).

## Validation before declaring done

1. **Tests**: `python -m pytest -q`. Baseline = **39 pass / 5 fail**. The 5
   failures are pre-existing (rate-limit, live-scores fixtures, standings
   finalize). A change is safe if those 37 stay green and no NEW failures appear.
2. **Offline simulation**: copy the prod DB to test against real data — you MUST
   copy all three SQLite files: `keeper_league.db` **+ `.db-wal` + `.db-shm`**
   (uncommitted WAL pages live in -wal; copying only .db misses recent writes).
3. **Visual render**: `_mobtest/` holds a puppeteer-core harness driving the
   installed Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) to
   screenshot pages/components at given viewports. Use it to confirm layout, no
   overflow. Type-check/build passing ≠ "looks right".
4. **Endpoint health (avoid the 404 trap)**: in SPA mode a 404 is served as the
   React shell with **HTTP 200**. So a bare `200` proves nothing. Test the REAL
   route with `?format=json` and expect **401** (auth required) — never a 500,
   never a 200 HTML shell. Example:
   `curl "https://keeperlg.com/leagues/1/team/1?format=json"` → `{"error":"Authentication required"}` 401.
