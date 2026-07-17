# VPS memory: why the alert fires, and what's already done

Context for the recurring **BinaryLane "Memory Consumption 102%"** alert on
`keeper-league` (43.224.183.136). Investigated 2026-07-17.

## The alert does not mean the box is out of memory

BinaryLane's agent (`/usr/local/bin/mpanel-memory-graph`) computes:

```python
memoryUsedInKilobytes = (MemTotal - MemFree) - Buffers - Cached + swapUsed
```

It **adds swap-used to RAM-used and divides by RAM total**, so any box with a
swapfile can exceed 100% while healthy. This VPS has 961MB RAM and a 2GB
swapfile, so the metric is structurally able to read ~100%+.

At the time of the alert: 415MB of 961MB RAM actually in use, 415MB available,
**zero OOM kills in 138 days of uptime**, load average 0.07. Nothing was wrong.

## The real driver: two apps on a 1GB box

| App | Baseline RSS | Peak (`VmHWM`) |
|---|---|---|
| AFL Manager (`aflmanager`, :8001) | **~357MB** | **599MB** |
| Keeper League (`keeper-league`, :8000) | ~200MB | 262MB |

AFLM's ~357MB is its *baseline*, not a leak — a freshly restarted worker starts
there. The old worker looked like "43MB RSS + 322MB swap" only because it sat
idle and got paged out; that stranded swap is what pushed the metric over 100%.

The two together (~560MB) plus system overhead leave little headroom, so idle
anon pages get evicted to swap and the metric climbs. **Restarting `aflmanager`
reclaims its swap but immediately pushes Keeper further into swap instead** —
observed live: keeper's swap went 34MB → 63MB the moment AFLM restarted.

Note `vm.swappiness` was **already 10** (not the default 60), so this is not
lazy swapping — the kernel evicted those pages because it genuinely had to.

## Done (2026-07-17)

- **logrotate** for `data/*.log` — `access.log` had reached 127MB, never rotated.
  See `deploy/logrotate-keeper-league`. Uses `copytruncate`; the app is never
  signalled or restarted.
- **journald capped** at `SystemMaxUse=200M` / `MaxRetentionSec=14day` and
  vacuumed — it was holding **1.9GB**. Freed 1.7GB; disk 69% → 59%.
- **`PRAGMA journal_size_limit=33554432`** in `app.py`'s SQLite connect hook.
  The `-wal` file had reached 57MB against a 36MB DB. It was checkpointing fine
  (`PASSIVE` returned `busy=0`, flushed all 593 pages) — SQLite just never
  shrinks the file below its high-water mark without this pragma.
- **`--max-requests 400 --max-requests-jitter 50`** added to `aflmanager`'s
  gunicorn (`/etc/systemd/system/aflmanager.service`, backup at
  `/root/aflmanager.service.bak.20260717`). Bounds the 599MB peak by recycling
  the worker gracefully after N requests. NOT applied to keeper-league: its
  eventlet `-w 1` worker holds the live draft websockets, and recycling would
  drop them.
- **Hourly memory report** → `/var/log/vps-mem-report.log`
  (`deploy/vps-mem-report.sh` + `/etc/cron.d/vps-mem-report`). Records the same
  metric BinaryLane alerts on, plus top consumers, and warns on any process
  >400MB RSS. Reports only — never restarts anything.

## The alert will probably fire again

After all of the above the metric still reads **~102%**, because ~560MB of
resident Python on a 961MB box means swap gets used, and swap counts. The
cleanup fixed real problems (disk, log growth, WAL, stranded swap) but cannot
fix the arithmetic.

Actual options, in order of honesty:

1. **Raise the alert threshold** (or disable the memory alert) at
   <https://home.binarylane.com.au/server/keeper-league/settings/alerts>. The
   metric is misleading for a swap-enabled box. Cheapest, changes nothing real.
2. **Resize the VPS to 2GB.** 1GB is genuinely tight for two Python web apps
   with pandas loaded. This is the real fix.
3. **Shrink AFLM's 357MB baseline** — it loads its data set at startup. Real
   engineering work; only worth it if 1 and 2 are both unacceptable.

Do **not** try `swapoff -a` to clear swap: with ~290MB swapped and only ~128MB
free, it will OOM-kill something.
