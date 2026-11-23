import { useParams, Link } from 'react-router'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { useWishlist } from '../../hooks/useWishlist'
import { useLeague, useStatsYear } from '../../contexts/LeagueContext'
import { useDensity } from '../../hooks/useDensity'
import { DensityToggle } from '../../components/ui/DensityToggle'
import { AcquiredHistory, type Acquired, type Stint } from '../../components/ui/PlayerHistory'

type AcquiredHistoryEntry = Stint

/**
 * Render a long list in chunks instead of all at once. Mounts `step` rows, then
 * appends another `step` whenever a sentinel near the list end scrolls into view.
 * Keeps the initial DOM small (the pool is 800+ rows) without a virtualization dep.
 * Resets to the first chunk when the source list changes (filter/sort). A sentinel
 * inside a display:none subtree never intersects, so the off-viewport list (the
 * hidden desktop table on mobile, or vice-versa) stays capped at one chunk.
 */
function useIncremental<T>(items: T[], step = 50) {
  const [count, setCount] = useState(step)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { setCount(step) }, [items, step])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || count >= items.length) return
    const io = new IntersectionObserver(
      e => { if (e[0].isIntersecting) setCount(c => Math.min(c + step, items.length)) },
      { rootMargin: '800px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [items, count, step])
  return { visible: items.slice(0, count), hasMore: count < items.length, sentinelRef }
}

interface PoolPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number
  games_played: number
  career_games: number
  rating: number | null
  rating_start: number | null
  potential: number | null
  injury_severity: string | null
  l3: number | null
  l5: number | null
  owner_team: string | null
  profile_tag: string | null
  profile_css: string | null
  profile_tier: number
  is_selected: boolean
  is_bye: boolean
  /** Set when this player was cut in one of this season's delist periods. */
  delisted?: { by: string | null; period: string | null; at: string | null } | null
  acquired: Acquired | null
  acquired_history?: AcquiredHistoryEntry[]
  /** Position is our estimate until SuperCoach publishes one. */
  position_expected?: boolean
  /** In his first season on an AFL list. */
  is_new?: boolean
  /** On a keeper list here but no longer on an AFL one. */
  is_former?: boolean
  on_block?: boolean
  note_count?: number
}

interface TeamColour { fg: string; bg: string }

/* ── Smart filters ───────────────────────────────────────────
   Each is a one-click answer to a question you'd otherwise have to build out
   of three dropdowns ("who just got cut?", "who's trending up?"). They stack,
   and each carries a live count of how many players it would leave. */

interface SmartFilter {
  key: string
  label: string
  icon: string
  tone: string
  hint: string
  group: 'avail' | 'form' | 'profile'
  test: (p: PoolPlayer, ctx: { myTeam: string | null }) => boolean
}

const GROUPS: { key: SmartFilter['group']; label: string }[] = [
  { key: 'avail', label: 'Availability' },
  { key: 'form', label: 'Form & trend' },
  { key: 'profile', label: 'Profile' },
]

/** The few worth surfacing without opening anything. */
const PINNED = ['new', 'delisted', 'available', 'mine']

const rtgMove = (p: PoolPlayer) =>
  p.rating != null && p.rating_start != null ? p.rating - p.rating_start : 0

const SMART_FILTERS: SmartFilter[] = [
  { group: 'avail', key: 'new', label: 'New to the AFL', icon: 'bi-stars', tone: 'gold',
    hint: 'First season on an AFL list', test: p => !!p.is_new },
  { group: 'avail', key: 'block', label: 'On the trade block', icon: 'bi-megaphone-fill', tone: 'orange',
    hint: 'Put up for trade by their club', test: p => !!p.on_block },
  { group: 'avail', key: 'noted', label: 'My notes', icon: 'bi-journal-text', tone: 'slate',
    hint: 'Players you have written a note on', test: p => (p.note_count || 0) > 0 },
  { group: 'avail', key: 'delisted', label: 'Delisted', icon: 'bi-scissors', tone: 'red',
    hint: 'Cut in a delist period this season',
    test: p => !!p.delisted },
  { group: 'avail', key: 'available', label: 'Free agents', icon: 'bi-unlock-fill', tone: 'green',
    hint: 'Not on anyone’s list', test: p => !p.owner_team },
  { group: 'avail', key: 'rostered', label: 'Rostered', icon: 'bi-lock-fill', tone: 'slate',
    hint: 'Already on a squad', test: p => !!p.owner_team },
  { group: 'avail', key: 'mine', label: 'My squad', icon: 'bi-person-badge-fill', tone: 'blue',
    hint: 'On your list', test: (p, c) => !!c.myTeam && p.owner_team === c.myTeam },
  { group: 'form', key: 'rising', label: 'Rising', icon: 'bi-graph-up-arrow', tone: 'green',
    hint: 'Rating up on the start of the year', test: p => rtgMove(p) > 0 },
  { group: 'form', key: 'falling', label: 'Falling', icon: 'bi-graph-down-arrow', tone: 'red',
    hint: 'Rating down on the start of the year', test: p => rtgMove(p) < 0 },
  { group: 'profile', key: 'upside', label: 'Upside', icon: 'bi-rocket-takeoff-fill', tone: 'purple',
    hint: 'Potential at least 8 above current rating',
    test: p => p.potential != null && p.rating != null && p.potential - p.rating >= 8 },
  { group: 'form', key: 'hot', label: 'In form', icon: 'bi-fire', tone: 'orange',
    hint: 'Last 3 at least 10 above season average',
    test: p => !!p.l3 && !!p.sc_avg && p.l3 - p.sc_avg >= 10 },
  { group: 'form', key: 'cold', label: 'Out of form', icon: 'bi-snow2', tone: 'blue',
    hint: 'Last 3 at least 10 below season average',
    test: p => !!p.l3 && !!p.sc_avg && p.sc_avg - p.l3 >= 10 },
  { group: 'profile', key: 'elite', label: 'Elite', icon: 'bi-star-fill', tone: 'gold',
    hint: 'Rated 85 or better', test: p => (p.rating || 0) >= 85 },
  { group: 'profile', key: 'kids', label: 'Under 23', icon: 'bi-hourglass-top', tone: 'teal',
    hint: 'Keeper-age talent', test: p => (p.age || 99) <= 23 },
  { group: 'profile', key: 'vets', label: '30 and over', icon: 'bi-hourglass-bottom', tone: 'slate',
    hint: 'The back nine', test: p => (p.age || 0) >= 30 },
  { group: 'profile', key: 'injured', label: 'Injured', icon: 'bi-bandaid-fill', tone: 'orange',
    hint: 'Carrying an injury', test: p => !!p.injury_severity },
  { group: 'profile', key: 'rookie', label: 'Rookies', icon: 'bi-asterisk', tone: 'teal',
    hint: 'Fewer than 10 career games', test: p => (p.career_games || 0) < 10 },
]

interface PoolData {
  league: { id: number; name: string; squad_size: number; trade_window_open?: boolean }
  players: PoolPlayer[]
  team_colours: Record<string, TeamColour>
  team_logos: Record<string, string>
  user_team_id: number | null
  user_team_name: string | null
  roster_count: number
  effective_roster_count: number
  ltil_count: number
  can_pickup: boolean
  pickup_reason?: string | null
  ssp_cutoff_round: number
  stats_year?: number
  stats_are_last_season?: boolean
  afl_year?: number
}

// CSS from templates/leagues/player_pool.html <style> block (trimmed to essentials)
const POOL_CSS = `
/* ═══ Player pool filters ═══════════════════════════════════════════
   Replaces a row of raw Bootstrap selects. Three bands: what you are
   looking for (search + position + facets), the one-click questions
   (smart filters, each with a live count), and what is currently applied.
   ═══════════════════════════════════════════════════════════════════ */
.pf {
  --pf-line: rgba(173,155,120,.16);
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--pf-line);
  background: linear-gradient(180deg, rgba(255,255,255,.025), transparent);
}
.pf-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.pf-search {
  flex: 1 1 240px; max-width: 340px; min-width: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 7px 11px; border-radius: 10px;
  background: rgba(255,255,255,.045);
  border: 1px solid var(--pf-line);
  transition: border-color .15s, background .15s;
}
.pf-search:focus-within { border-color: rgba(246,195,91,.55); background: rgba(255,255,255,.07); }
.pf-search i { color: #837b71; font-size: .82rem; }
.pf-search input { all: unset; flex: 1; min-width: 0; font-size: .82rem; color: #f1efed; }
.pf-search input::placeholder { color: #726b64; }
.pf-search button { all: unset; cursor: pointer; color: #837b71; display: grid; place-items: center; }
.pf-search button:hover { color: #f1efed; }

/* Position — a segmented control, not a dropdown. Four options should
   never cost a click to see. */
.pf-seg {
  display: inline-flex; padding: 3px; border-radius: 10px;
  background: rgba(255,255,255,.04); border: 1px solid var(--pf-line);
}
.pf-seg-btn {
  all: unset; cursor: pointer;
  padding: 5px 12px; border-radius: 7px;
  font-size: .74rem; font-weight: 750; color: #a89a8b;
  transition: background .14s, color .14s;
}
.pf-seg-btn:hover { color: #edeae6; }
.pf-seg-btn.on { background: rgba(255,255,255,.1); color: #fff; }
.pf-seg-btn.on.pf-seg-DEF { background: rgba(246,191,80,.2); color: #f8cf7c; }
.pf-seg-btn.on.pf-seg-MID { background: rgba(238,229,184,.2); color: #f7f3de; }
.pf-seg-btn.on.pf-seg-RUC { background: rgba(255,164,95,.2); color: #ffc393; }
.pf-seg-btn.on.pf-seg-FWD { background: rgba(255,125,143,.2); color: #ffa6b3; }

.pf-selects { display: flex; gap: 7px; flex-wrap: wrap; }
.pf-select {
  background: rgba(255,255,255,.04);
  border: 1px solid var(--pf-line);
  border-radius: 9px;
  color: #dad4ce; font-size: .76rem; font-weight: 600;
  padding: 7px 9px; cursor: pointer; max-width: 160px;
}
.pf-select:hover { background: rgba(255,255,255,.08); }
.pf-select:focus { outline: none; border-color: rgba(246,195,91,.5); }
.pf-density { margin-left: auto; }

/* Smart filters */
.pf-pinned { display: flex; gap: 6px; flex-wrap: wrap; }
.pf-chip {
  all: unset;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 11px; border-radius: 999px;
  font-size: .74rem; font-weight: 700;
  color: #afa396;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--pf-line);
  cursor: pointer;
  transition: background .14s, border-color .14s, color .14s;
}
.pf-chip i { font-size: .74rem; opacity: .8; }
.pf-chip-n {
  font-size: .64rem; font-weight: 800; color: #7b736a;
  background: rgba(255,255,255,.06);
  border-radius: 999px; padding: 1px 6px; min-width: 20px; text-align: center;
}
.pf-chip:hover:not(:disabled) { background: rgba(255,255,255,.09); color: #efece9; }
.pf-chip:disabled { opacity: .3; cursor: default; }
.pf-chip.on { color: #fff; }
.pf-chip.on .pf-chip-n { background: rgba(0,0,0,.28); color: #fff; }
.pf-red.on    { background: rgba(248,81,73,.22);  border-color: rgba(248,81,73,.55);  color: #ffb3ae; }
.pf-green.on  { background: rgba(219,207,148,.2);   border-color: rgba(219,207,148,.55);  color: #f6f2da; }
.pf-blue.on   { background: rgba(245,185,64,.2);  border-color: rgba(245,185,64,.55); color: #f9d284; }
.pf-purple.on { background: rgba(188,140,255,.2); border-color: rgba(188,140,255,.55);color: #d6b8ff; }
.pf-orange.on { background: rgba(240,144,80,.22); border-color: rgba(240,144,80,.55); color: #ffbd90; }
.pf-gold.on   { background: rgba(227,130,65,.22); border-color: rgba(227,130,65,.55); color: #f2b389; }
.pf-teal.on   { background: rgba(185,145,84,.2);  border-color: rgba(185,145,84,.5);  color: #dcc8aa; }
.pf-slate.on  { background: rgba(163,149,134,.22);border-color: rgba(163,149,134,.5); color: #e0dcd7; }

/* ── Filters button + panel ──────────────────────────────────────── */
.pf-more-wrap { position: relative; }
.pf-more {
  all: unset;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 13px; border-radius: 10px;
  font-size: .76rem; font-weight: 700; color: #c4b69b;
  background: rgba(255,255,255,.045);
  border: 1px solid var(--pf-line);
  cursor: pointer;
  transition: background .14s, border-color .14s, color .14s;
}
.pf-more:hover, .pf-more.open { background: rgba(255,255,255,.1); color: #fff; }
.pf-more.open { border-color: rgba(246,195,91,.5); }
.pf-more.has { border-color: rgba(246,195,91,.45); color: #f0edea; }
.pf-more-n {
  font-size: .64rem; font-weight: 800; color: #131110;
  background: #f6c053; border-radius: 999px;
  padding: 1px 6px; min-width: 18px; text-align: center;
}
.pf-more-chev { font-size: .62rem; opacity: .6; }

.pf-panel {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 60;
  width: 460px; max-width: min(92vw, 460px);
  padding: 14px;
  border-radius: 14px;
  background: #171614;
  border: 1px solid rgba(173,155,120,.28);
  box-shadow: 0 26px 60px -22px rgba(0,0,0,.95);
  animation: pfPanel .14s cubic-bezier(.2,.8,.2,1);
}
@keyframes pfPanel { from { opacity: 0; transform: translateY(-6px); } }
.pf-group + .pf-group { margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--pf-line); }
.pf-group-h {
  font-size: .58rem; font-weight: 900; letter-spacing: .16em;
  text-transform: uppercase; color: #777067; margin-bottom: 8px;
}
.pf-group-items { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }

/* Rows, not pills. A list reads down in one pass; a pill cloud makes the
   eye hunt. Colour lives on the icon only, so nothing shouts at rest. */
.pf-opt {
  all: unset;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 9px; border-radius: 8px;
  font-size: .78rem; color: #c2b9ae;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background .12s, color .12s, border-color .12s;
}
.pf-opt:hover:not(:disabled) { background: rgba(255,255,255,.06); color: #fff; }
.pf-opt:disabled { opacity: .28; cursor: default; }
.pf-opt-i { font-size: .78rem; width: 15px; text-align: center; }
.pf-opt-l { flex: 1; min-width: 0; font-weight: 650; }
.pf-opt-n { font-size: .68rem; font-weight: 700; color: #777067; font-variant-numeric: tabular-nums; }
.pf-opt.on {
  background: rgba(246,195,91,.14);
  border-color: rgba(246,195,91,.34);
  color: #fff;
}
.pf-opt.on .pf-opt-n { color: #f9d284; }

.pf-red-i { color: #ff8a80; }
.pf-green-i { color: #efe7bd; }
.pf-blue-i { color: #f6c35c; }
.pf-purple-i { color: #d2a8ff; }
.pf-orange-i { color: #ffa56b; }
.pf-gold-i { color: #e38241; }
.pf-teal-i { color: #c6a573; }
.pf-slate-i { color: #b2a699; }

.pf-panel-selects { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pf-panel-selects .pf-select { max-width: none; width: 100%; }
.pf-panel-selects .pf-select:first-child { grid-column: 1 / -1; }
.pf-panel-foot {
  display: flex; align-items: center; gap: 8px;
  margin-top: 13px; padding-top: 11px;
  border-top: 1px solid var(--pf-line);
}
.pf-apply {
  all: unset; margin-left: auto; cursor: pointer;
  padding: 6px 16px; border-radius: 8px;
  font-size: .76rem; font-weight: 800; color: #131110;
  background: linear-gradient(100deg, #f6c053, #f4b434);
}
.pf-apply:hover { filter: brightness(1.08); }

/* ── Applied row ─────────────────────────────────────────────────── */
.pf-status {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-top: 10px; padding-top: 9px;
  border-top: 1px dashed var(--pf-line);
}
.pf-count { font-size: .75rem; color: #9a8b7a; }
.pf-count b { color: #f1efed; font-weight: 800; font-size: .82rem; }
.pf-applied { display: flex; flex-wrap: wrap; gap: 5px; }
.pf-tag {
  all: unset;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 999px;
  font-size: .68rem; font-weight: 700; color: #e0dcd7;
  background: rgba(246,195,91,.14);
  border: 1px solid rgba(246,195,91,.3);
  cursor: pointer;
}
.pf-tag i { font-size: .66rem; opacity: .7; }
.pf-tag:hover { background: rgba(248,81,73,.18); border-color: rgba(248,81,73,.4); color: #ffb3ae; }
.pf-clear {
  all: unset; cursor: pointer;
  font-size: .72rem; font-weight: 700; color: #9a8b7a;
  padding: 5px 11px; border-radius: 7px;
  border: 1px solid var(--pf-line);
  background: rgba(255,255,255,.03);
}
.pf-clear:hover { color: #fff; background: rgba(255,255,255,.1); }
/* Only the status-row instance floats right; in the panel footer the Show
   button owns that side. */
.pf-status .pf-clear { margin-left: auto; }

@media (max-width: 1200px) {
  .pf-select { max-width: 128px; }
  .pf-density { margin-left: 0; }
}

.pf-smart-sheet { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0; }

@media (max-width: 1200px) {
  .pf-select { max-width: 128px; }
  .pf-density { margin-left: 0; }
}

.pool-table th { padding: .5rem .6rem; font-size: .7rem; border-bottom: 2px solid #373330; position: relative; cursor: pointer; user-select: none; }
.pool-table th .sort-icon { font-size: .6rem; margin-left: 2px; opacity: .4; }
.pool-table th.sort-active .sort-icon { opacity: 1; color: #f5b940; }
.pool-table td { padding: .45rem .6rem; vertical-align: middle; font-size: .8rem; }
.pool-table tbody tr { transition: background .1s; }
.pool-table tbody tr:hover { background: rgba(245,185,64,.04) !important; }
.profile-tag { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: .6rem; font-weight: 700; white-space: nowrap; letter-spacing: .3px; }
.tag-elite { background: linear-gradient(135deg, rgba(249,192,6,.3), rgba(245,104,10,.25)); color: #f9c006; border: 1px solid rgba(249,192,6,.4); }
.tag-elite-vet { background: linear-gradient(135deg, rgba(192,132,252,.25), rgba(244,183,60,.2)); color: #c084fc; border: 1px solid rgba(192,132,252,.35); }
.tag-premium { background: linear-gradient(135deg, rgba(251,127,60,.2), rgba(245,105,11,.15)); color: #fb7f3c; }
.tag-rising { background: rgba(165,120,29,.18); color: #a5781d; }
.tag-breakout { background: rgba(185,122,14,.18); color: #b97a0e; }
.tag-proven { background: rgba(243,173,31,.15); color: #f3ad1f; }
.tag-steady { background: rgba(178,167,154,.12); color: #b2a79a; }
.tag-developing { background: rgba(228,213,139,.1); color: #e4d58b; }
.tag-project { background: rgba(232,99,10,.12); color: #e8630a; }
.tag-declining { background: rgba(239,68,68,.15); color: #ef4444; }
.tag-veteran { background: rgba(122,115,106,.12); color: #b0a496; }
.tag-fringe { background: rgba(93,87,80,.1); color: #7e766d; }
.filter-bar { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.filter-bar .form-control-sm, .filter-bar .form-select-sm { background: #121110; border-color: #373330; font-size: .78rem; }
.pool-count { font-size: .75rem; color: #a39586; white-space: nowrap; display: flex; align-items: center; gap: .35rem; }
.pool-count strong { color: #d7d1cb; }
.pm-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #22201e; cursor: pointer; background: #121110; }
.pm-card:active { background: #1c1a18; }
.pm-taken { opacity: .5; }
.pm-logo { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; border-radius: 4px; }
.pm-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pm-row1 { display: flex; align-items: center; gap: 5px; }
.pm-name { font-weight: 700; font-size: .84rem; color: #efedea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pm-pos-badge { padding: 1px 5px; font-size: .55rem; }
.pm-row2 { display: flex; align-items: center; gap: 5px; font-size: .67rem; color: #80786f; }
.pm-row2 b { color: #d7d1cb; font-weight: 700; }
.pm-sep { width: 1px; height: 9px; background: #272522; flex-shrink: 0; }
.pm-right { flex-shrink: 0; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.pm-sc { font-size: 1.05rem; font-weight: 800; color: #efedea; line-height: 1; }
.pm-sc-none { color: #56504a; font-size: .85rem; }
.pm-owner { font-size: .58rem; font-weight: 700; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
.pm-fa { font-size: .58rem; font-weight: 600; color: #dbcf94; }
.pm-add { background: rgba(219,207,148,.12); border: none; color: #dbcf94; border-radius: 4px; font-size: .58rem; font-weight: 700; cursor: pointer; padding: 2px 8px; }
.pm-l3 { color: #d7d1cb; }
.pm-l3 b { font-weight: 700; }
.pm-l3-delta { font-size: .58rem; font-weight: 700; margin-left: 2px; }
.pm-l3-delta-up { color: #dbcf94; }
.pm-l3-delta-down { color: #f85149; }
.pm-l3-delta-flat { color: #56504a; }
.wishlist-star { cursor: pointer; background: none; border: none; padding: 4px 6px; color: #80786f; font-size: .95rem; line-height: 1; transition: color .15s, transform .15s; }
.wishlist-star:hover { color: #d26822; }
.wishlist-star.active { color: #d26822; }
.wishlist-star:active { transform: scale(1.2); }
`

type SortKey = 'name' | 'pos' | 'age' | 'sc_avg' | 'trend' | 'rating' | 'rtg_move' | 'potential' | 'tag'

function sortValue(p: PoolPlayer, key: SortKey): number | string {
  switch (key) {
    case 'name': return p.name.toLowerCase()
    case 'pos': return p.position
    case 'age': return p.age || 0
    case 'sc_avg': return p.sc_avg || 0
    case 'trend': return (p.l3 || 0) - (p.sc_avg || 0)
    case 'rating': return p.rating || 0
    case 'rtg_move': return (p.rating || 0) - (p.rating_start || p.rating || 0)
    case 'potential': return p.potential || 0
    case 'tag': return p.profile_tier || 13
  }
}

type MobileSortKey = 'sc' | 'name_asc' | 'age' | 'rtg' | 'gp'

export function PlayerPoolPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<PoolData>(`/leagues/${leagueId}/player-pool?format=json`)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [smart, setSmart] = useState<Set<string>>(new Set())
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [sortKey, setSortKey] = useState<SortKey>('sc_avg')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [mobSort, setMobSort] = useState<MobileSortKey>('sc')
  const [pickingUp, setPickingUp] = useState<number | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const wishlist = useWishlist(leagueId)
  // LeagueContext (separate from data.league below — that one is the
  // PoolData league summary, this one carries the teams[] roster for
  // the trade-from-row deep link).
  const { league: leagueCtx } = useLeague()
  // Until the new season has a game played, every average on this page is
  // last season's, and the column headers say which.
  const stats = useStatsYear()
  // Owner name → team_id lookup. PoolData.players.owner_team is a name
  // string; we resolve it against LeagueContext.teams to build the
  // trade-propose URL.
  const ownerNameToId = useMemo(() => {
    const m = new Map<string, number>()
    leagueCtx?.teams.forEach(t => m.set(t.name, t.id))
    return m
  }, [leagueCtx])
  // Desktop density. Mobile uses its own card layout (kl-player-card)
  // that already runs tight, so the toggle is desktop-only.
  const { density, setDensity } = useDensity('players.pool.density')

  const base = useMemo(() => {
    if (!data) return []
    const needle = search.toLowerCase().trim()
    return data.players.filter(p => {
      if (needle && !p.name.toLowerCase().includes(needle)) return false
      if (posFilter) {
        const parts = (p.position || 'MID').split('/')
        if (!parts.includes(posFilter)) return false
      }
      if (teamFilter && p.afl_team !== teamFilter) return false
      if (ageFilter) {
        const age = p.age || 0
        if (ageFilter === '21' && age > 21) return false
        if (ageFilter === '23' && age > 23) return false
        if (ageFilter === '25' && age > 25) return false
        if (ageFilter === '25-30' && (age < 25 || age > 30)) return false
        if (ageFilter === '30+' && age < 30) return false
      }
      if (statusFilter === 'available' && p.owner_team) return false
      if (statusFilter === 'taken' && !p.owner_team) return false
      if (ownerFilter && p.owner_team !== ownerFilter) return false
      return true
    })
  }, [data, search, posFilter, teamFilter, ageFilter, statusFilter, ownerFilter])

  const myTeam = data?.user_team_name ?? null
  const smartCtx = useMemo(() => ({ myTeam }), [myTeam])

  const filtered = useMemo(
    () => (smart.size === 0
      ? base
      : base.filter(p => SMART_FILTERS.every(
          f => !smart.has(f.key) || f.test(p, smartCtx)))),
    [base, smart, smartCtx],
  )

  const smartCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const f of SMART_FILTERS) {
      // Count within everything else that's active, so a chip never promises
      // results the other filters would rule out.
      const others = SMART_FILTERS.filter(o => o.key !== f.key && smart.has(o.key))
      out[f.key] = base.reduce((n, p) =>
        n + (f.test(p, smartCtx) && others.every(o => o.test(p, smartCtx)) ? 1 : 0), 0)
    }
    return out
  }, [base, smart, smartCtx])

  function toggleSmart(key: string) {
    setSmart(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  function clearFilters() {
    setPosFilter(''); setTeamFilter(''); setAgeFilter('')
    setStatusFilter(''); setOwnerFilter(''); setSmart(new Set())
  }

  const sorted = useMemo(() => {
    const out = [...filtered]
    out.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -sortDir
      if (av > bv) return sortDir
      return 0
    })
    return out
  }, [filtered, sortKey, sortDir])

  const mobileSorted = useMemo(() => {
    const out = [...filtered]
    out.sort((a, b) => {
      switch (mobSort) {
        case 'sc': return (b.sc_avg || 0) - (a.sc_avg || 0)
        case 'name_asc': return a.name.localeCompare(b.name)
        case 'age': return (a.age || 99) - (b.age || 99)
        case 'rtg': return (b.rating || 0) - (a.rating || 0)
        case 'gp': return (b.games_played || 0) - (a.games_played || 0)
        default: return 0
      }
    })
    return out
  }, [filtered, mobSort])

  // Chunked rendering so the 800+ row pool doesn't all mount at once (mobile perf).
  const desk = useIncremental(sorted)
  const mob = useIncremental(mobileSorted)

  const teamOptions = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    data.players.forEach(p => { if (p.afl_team) s.add(p.afl_team) })
    return [...s].sort()
  }, [data])

  const ownerOptions = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    data.players.forEach(p => { if (p.owner_team) s.add(p.owner_team) })
    return [...s].sort()
  }, [data])

  const activeFilterCount =
    [posFilter, teamFilter, ageFilter, statusFilter, ownerFilter].filter(Boolean).length + smart.size

  // Close the filter panel on outside click / Escape.
  useEffect(() => {
    if (!panelOpen) return
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPanelOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [panelOpen])

  async function pickup(playerId: number) {
    if (!confirm('Pick this player up?')) return
    setPickingUp(playerId)
    try {
      const res = await fetch(`/leagues/${leagueId}/player-pool/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
        credentials: 'include',
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(d.error || 'Failed to pick up player')
      } else {
        refetch()
      }
    } finally {
      setPickingUp(null)
    }
  }

  if (loading) return <Spinner text="Loading player pool..." />
  if (!data) return <p className="text-danger">Failed to load player pool</p>

  const { league, team_colours, can_pickup, effective_roster_count, ltil_count, ssp_cutoff_round } = data

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(-1) }
  }

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return 'bi-chevron-expand'
    return sortDir === -1 ? 'bi-chevron-down' : 'bi-chevron-up'
  }

  return (
    <div>
      <style>{POOL_CSS}</style>
      <div className="d-none d-lg-block">
        <PlayersSubnav active="pool" leagueId={leagueId!} />
      </div>

      <div className="page-header d-none d-lg-block">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link> / Players / Pool
        </div>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-2">
          <div>
            <h2 className="mb-0">Player Pool</h2>
            {stats.isLast && (
              <span className="kl-season-note">
                <i className="bi bi-calendar3"></i> Averages, L3 and L5 are from the {stats.label} season
              </span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="pool-count">
              <strong>{sorted.length}</strong> players
            </div>
          </div>
        </div>
      </div>

      {can_pickup && (
        <div
          className="d-flex align-items-center gap-2 mb-3 px-3 py-2 d-none d-lg-flex"
          style={{ background: 'rgba(219,207,148,.08)', border: '1px solid rgba(219,207,148,.2)', borderRadius: 8, fontSize: '.82rem' }}
        >
          <i className="bi bi-person-plus-fill" style={{ color: '#dbcf94' }}></i>
          <span style={{ color: '#d7d1cb' }}>
            SSP pickups open — <strong>{effective_roster_count}/{league.squad_size}</strong> roster spots filled
            {ltil_count ? ` (${ltil_count} on LTIL)` : ''}. Closes at Round {ssp_cutoff_round}.
          </span>
        </div>
      )}

      {!can_pickup && data.pickup_reason && data.user_team_id && (
        <div
          className="d-flex align-items-center gap-2 mb-3 px-3 py-2"
          style={{
            background: 'rgba(210,104,34,.08)',
            border: '1px solid rgba(210,104,34,.3)',
            borderRadius: 8,
            fontSize: '.82rem',
          }}
        >
          <i className="bi bi-info-circle-fill" style={{ color: '#d26822' }}></i>
          <span style={{ color: '#f0b38a' }}>
            <strong>Free-agent pickups paused.</strong>
            <span style={{ color: '#d7d1cb', marginLeft: 6, fontWeight: 400 }}>{data.pickup_reason}</span>
          </span>
        </div>
      )}

      <div className="card d-none d-lg-block" data-density={density}>
        <div className="pf">
          {/* Row 1 — search, positions, facets, density */}
          <div className="pf-row">
            <label className="pf-search">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder="Search players…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search players"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <i className="bi bi-x" />
                </button>
              )}
            </label>

            <div className="pf-seg" role="group" aria-label="Position">
              {['', 'DEF', 'MID', 'RUC', 'FWD'].map(v => (
                <button
                  key={v || 'all'}
                  type="button"
                  className={`pf-seg-btn${posFilter === v ? ' on' : ''}${v ? ` pf-seg-${v}` : ''}`}
                  onClick={() => setPosFilter(v)}
                >
                  {v || 'All'}
                </button>
              ))}
            </div>

            {/* Only the handful worth seeing without asking. Everything else
                lives one click away — fourteen equal-weight pills was a wall. */}
            <div className="pf-pinned">
              {PINNED.map(k => {
                const f = SMART_FILTERS.find(x => x.key === k)
                if (!f || (f.key === 'mine' && !myTeam)) return null
                const n = smartCounts[f.key] ?? 0
                const on = smart.has(f.key)
                return (
                  <button
                    key={f.key} type="button" title={f.hint}
                    className={`pf-chip pf-${f.tone}${on ? ' on' : ''}`}
                    onClick={() => toggleSmart(f.key)}
                    disabled={!on && n === 0} aria-pressed={on}
                  >
                    <i className={`bi ${f.icon}`} />{f.label}
                    <span className="pf-chip-n">{n}</span>
                  </button>
                )
              })}
            </div>

            <div className="pf-more-wrap" ref={panelRef}>
              <button
                type="button"
                className={`pf-more${panelOpen ? ' open' : ''}${activeFilterCount > 0 ? ' has' : ''}`}
                onClick={() => setPanelOpen(o => !o)}
                aria-expanded={panelOpen}
              >
                <i className="bi bi-sliders" />
                Filters
                {activeFilterCount > 0 && <span className="pf-more-n">{activeFilterCount}</span>}
                <i className={`bi bi-chevron-${panelOpen ? 'up' : 'down'} pf-more-chev`} />
              </button>

              {panelOpen && (
                <div className="pf-panel" role="dialog" aria-label="Filters">
                  {GROUPS.map(g => {
                    const items = SMART_FILTERS.filter(
                      f => f.group === g.key && !(f.key === 'mine' && !myTeam))
                    if (!items.length) return null
                    return (
                      <div className="pf-group" key={g.key}>
                        <div className="pf-group-h">{g.label}</div>
                        <div className="pf-group-items">
                          {items.map(f => {
                            const n = smartCounts[f.key] ?? 0
                            const on = smart.has(f.key)
                            return (
                              <button
                                key={f.key} type="button" title={f.hint}
                                className={`pf-opt${on ? ' on' : ''}`}
                                onClick={() => toggleSmart(f.key)}
                                disabled={!on && n === 0} aria-pressed={on}
                              >
                                <i className={`bi ${f.icon} pf-opt-i pf-${f.tone}-i`} />
                                <span className="pf-opt-l">{f.label}</span>
                                <span className="pf-opt-n">{n}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  <div className="pf-group">
                    <div className="pf-group-h">Narrow it down</div>
                    <div className="pf-panel-selects">
                      <select className="pf-select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} aria-label="AFL club">
                        <option value="">Any club</option>
                        {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select className="pf-select" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} aria-label="Coach">
                        <option value="">Any coach</option>
                        {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select className="pf-select" value={ageFilter} onChange={e => setAgeFilter(e.target.value)} aria-label="Age band">
                        <option value="">Any age</option>
                        <option value="21">U21</option>
                        <option value="23">U23</option>
                        <option value="25">U25</option>
                        <option value="25-30">25–30</option>
                        <option value="30+">30+</option>
                      </select>
                    </div>
                  </div>

                  <div className="pf-panel-foot">
                    <button type="button" className="pf-clear" onClick={clearFilters}>Clear all</button>
                    <button type="button" className="pf-apply" onClick={() => setPanelOpen(false)}>
                      Show {sorted.length}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="pf-density"><DensityToggle density={density} onChange={setDensity} /></span>
          </div>


          {/* Row 3 — what is actually applied */}
          <div className="pf-status">
            <span className="pf-count">
              <b>{sorted.length}</b> of {data.players.length} players
            </span>
            {activeFilterCount > 0 && (
              <>
                <span className="pf-applied">
                  {[...smart].map(k => {
                    const f = SMART_FILTERS.find(x => x.key === k)
                    return f ? (
                      <button key={k} type="button" className="pf-tag" onClick={() => toggleSmart(k)}>
                        {f.label}<i className="bi bi-x" />
                      </button>
                    ) : null
                  })}
                  {posFilter && <button type="button" className="pf-tag" onClick={() => setPosFilter('')}>{posFilter}<i className="bi bi-x" /></button>}
                  {teamFilter && <button type="button" className="pf-tag" onClick={() => setTeamFilter('')}>{teamFilter}<i className="bi bi-x" /></button>}
                  {ownerFilter && <button type="button" className="pf-tag" onClick={() => setOwnerFilter('')}>{ownerFilter}<i className="bi bi-x" /></button>}
                  {ageFilter && <button type="button" className="pf-tag" onClick={() => setAgeFilter('')}>{ageFilter}<i className="bi bi-x" /></button>}
                  {statusFilter && <button type="button" className="pf-tag" onClick={() => setStatusFilter('')}>{statusFilter}<i className="bi bi-x" /></button>}
                </span>
                <button type="button" className="pf-clear" onClick={clearFilters}>Clear all</button>
              </>
            )}
          </div>
        </div>

        {/* Desktop table */}
        <div className="card-body p-0 d-none d-lg-block" style={{ maxHeight: '78vh', overflow: 'auto' }}>
          <table className="table table-sm mb-0 pool-table">
            <thead className="sticky-top" style={{ background: '#1c1a18', zIndex: 2 }}>
              <tr>
                <th style={{ width: 18 }}></th>
                <th className={sortKey === 'name' ? 'sort-active' : ''} onClick={() => toggleSort('name')}>
                  Player <i className={`bi ${sortIcon('name')} sort-icon`}></i>
                </th>
                <th className={sortKey === 'pos' ? 'sort-active' : ''} style={{ width: 80 }} onClick={() => toggleSort('pos')}>
                  Pos <i className={`bi ${sortIcon('pos')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'age' ? 'sort-active ' : ''}text-center`} style={{ width: 45 }} onClick={() => toggleSort('age')}>
                  Age <i className={`bi ${sortIcon('age')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'sc_avg' ? 'sort-active ' : ''}text-end`} style={{ width: 78 }} onClick={() => toggleSort('sc_avg')}
                  title={stats.isLast ? `SuperCoach average for the ${stats.label} season` : 'SuperCoach average this season'}>
                  {stats.tag ? `SC ${stats.tag}` : 'SC'} <i className={`bi ${sortIcon('sc_avg')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'trend' ? 'sort-active ' : ''}text-center`} style={{ width: 88 }} onClick={() => toggleSort('trend')}
                  title={stats.isLast ? `Average of his last 3 games of ${stats.label}` : 'Average of his last 3 games'}>
                  {stats.tag ? `L3 ${stats.tag}` : 'L3'} <i className={`bi ${sortIcon('trend')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'rating' ? 'sort-active ' : ''}text-end`} style={{ width: 50 }} onClick={() => toggleSort('rating')}>
                  Rtg <i className={`bi ${sortIcon('rating')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'rtg_move' ? 'sort-active ' : ''}text-center`} style={{ width: 50 }} onClick={() => toggleSort('rtg_move')}>
                  +/- <i className={`bi ${sortIcon('rtg_move')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'potential' ? 'sort-active ' : ''}text-end`} style={{ width: 50 }} onClick={() => toggleSort('potential')}>
                  Pot <i className={`bi ${sortIcon('potential')} sort-icon`}></i>
                </th>
                <th className={sortKey === 'tag' ? 'sort-active' : ''} style={{ width: 120 }} onClick={() => toggleSort('tag')}>
                  Profile <i className={`bi ${sortIcon('tag')} sort-icon`}></i>
                </th>
                <th style={{ width: 196 }}>Acquired</th>
                <th className="text-center" style={{ width: 110 }}>Status</th>
                <th className="text-center" style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {desk.visible.map(p => {
                const positions = (p.position || 'MID').split('/')
                const tc = p.owner_team ? team_colours[p.owner_team] : null
                const l3Base = p.sc_avg || p.l3 || 0
                const l3Diff = (p.l3 || 0) - l3Base
                const l3Pct = l3Base ? (l3Diff / l3Base) * 100 : 0
                const rtgMove = p.rating && p.rating_start ? p.rating - p.rating_start : 0
                return (
                  <tr
                    key={p.id}
                    onClick={() => { window.location.href = `/player/${encodeURIComponent(p.name)}` }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '0 0 0 .4rem', verticalAlign: 'middle' }}>
                      {p.is_bye ? <span className="status-dot status-dot-bye"></span>
                        : p.is_selected ? <span className="status-dot status-dot-taken"></span>
                        : p.injury_severity ? <span className="status-dot status-dot-injured"></span>
                        : <span className="status-dot status-dot-available"></span>}
                    </td>
                    <td>
                      <span className="player-link" style={{cursor:"default"}}>
                        {p.afl_team && data.team_logos[p.afl_team] && (
                          <img
                            src={data.team_logos[p.afl_team]}
                            alt=""
                            className="team-icon"
                            style={{ width: 16, height: 16, marginRight: 4, verticalAlign: 'middle' }}
                          />
                        )}
                        <span className="p-name">{p.name}</span>
                        {p.is_new && <span className="pl-mark pl-mark-new" title={`New to the AFL in ${data.afl_year ?? ''}`}>NEW</span>}
                        {p.is_former && <span className="pl-mark pl-mark-off" title="No longer on an AFL list">OFF AFL LIST</span>}
                        {p.on_block && <i className="bi bi-megaphone-fill pl-ico pl-ico-block" title="On the trade block"></i>}
                        {(p.note_count || 0) > 0 && <i className="bi bi-journal-text pl-ico" title={`${p.note_count} note${p.note_count === 1 ? '' : 's'} of yours`}></i>}
                        <span style={{ color: '#d7d1cb', fontSize: '.72rem', marginLeft: 'auto' }}>{p.afl_team}</span>
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
                        {['FWD', 'DEF', 'RUC', 'MID'].filter(pos => positions.includes(pos)).map(pos => (
                          <span key={pos} className={`pos-badge badge-${pos.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`}
                            style={{ padding: '2px 5px', fontSize: '.65rem' }}
                            title={p.position_expected ? 'Expected position. He has no SuperCoach position yet.' : undefined}>
                            {pos}{p.position_expected ? ' exp' : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center" style={{ color: '#a39586' }}>{p.age || '-'}</td>
                    <td className="text-end">
                      {p.sc_avg ? <span style={{ fontWeight: 600 }}>{p.sc_avg.toFixed(1)}</span> : <span style={{ color: '#56504a' }}>-</span>}
                    </td>
                    <td className="text-center">
                      {p.l3 ? (
                        <>
                          <span style={{ fontWeight: 600, color: '#d7d1cb' }}>{Math.round(p.l3)}</span>
                          {l3Pct > 2 ? <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#dbcf94', marginLeft: 2 }}>+{Math.round(l3Pct)}%</span>
                            : l3Pct < -2 ? <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#f85149', marginLeft: 2 }}>{Math.round(l3Pct)}%</span>
                            : <span style={{ fontSize: '.65rem', color: '#56504a', marginLeft: 2 }}>-</span>}
                        </>
                      ) : <span style={{ color: '#56504a' }}>-</span>}
                    </td>
                    <td className="text-end">
                      {p.rating ? <span style={{ color: '#d7d1cb', fontWeight: 600 }}>{p.rating}</span> : <span style={{ color: '#56504a' }}>-</span>}
                    </td>
                    <td className="text-center">
                      {p.rating && p.rating_start ? (
                        rtgMove > 0 ? <span style={{ color: '#dbcf94', fontWeight: 600, fontSize: '.78rem' }}>+{rtgMove}</span>
                          : rtgMove < 0 ? <span style={{ color: '#f85149', fontWeight: 600, fontSize: '.78rem' }}>{rtgMove}</span>
                          : <span style={{ color: '#56504a', fontSize: '.78rem' }}>-</span>
                      ) : <span style={{ color: '#56504a' }}>-</span>}
                    </td>
                    <td className="text-end">
                      {p.potential ? <span style={{ color: '#d7d1cb', fontWeight: 600 }}>{p.potential}</span> : <span style={{ color: '#56504a' }}>-</span>}
                    </td>
                    <td>
                      {p.profile_tag && p.profile_css && (
                        <span className={`profile-tag tag-${p.profile_css}`}>{p.profile_tag}</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <AcquiredHistory history={p.acquired_history} fallback={p.acquired} />
                    </td>
                    <td className="text-center">
                      {p.owner_team ? (
                        <span
                          className="pm-owner"
                          style={{ background: tc?.bg, color: tc?.fg }}
                        >
                          {p.owner_team}
                        </span>
                      ) : can_pickup ? (
                        <button
                          className="pm-add"
                          onClick={e => { e.stopPropagation(); pickup(p.id) }}
                          disabled={pickingUp === p.id}
                        >
                          {pickingUp === p.id ? '...' : <><i className="bi bi-plus-lg"></i> Add</>}
                        </button>
                      ) : (
                        <span className="pm-fa">FA</span>
                      )}
                    </td>
                    <td className="text-center" style={{ padding: 0, whiteSpace: 'nowrap' }}>
                      {/* Fixed-layout wrapper so the star sits at the same x-position
                          on every row regardless of whether the trade button is shown.
                          Trade slot is always reserved (~26px) and filled when the
                          player is owned by another team. */}
                      <span className="d-inline-flex align-items-center">
                        <button
                          type="button"
                          className={`wishlist-star${wishlist.isWishlisted(p.id) ? ' active' : ''}`}
                          onClick={e => { e.stopPropagation(); wishlist.toggle(p.id) }}
                          title={wishlist.isWishlisted(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                          aria-label={wishlist.isWishlisted(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <i className={`bi ${wishlist.isWishlisted(p.id) ? 'bi-star-fill' : 'bi-star'}`}></i>
                        </button>
                        {p.owner_team && p.owner_team !== leagueCtx?.user_team?.name && ownerNameToId.has(p.owner_team) ? (
                          <Link
                            to={`/leagues/${leagueId}/trades/propose?with=${p.id}&from=${ownerNameToId.get(p.owner_team)}`}
                            className="trade-from-row"
                            title={`Propose trade for ${p.name} with ${p.owner_team}`}
                            aria-label={`Propose trade for ${p.name}`}
                            onClick={e => e.stopPropagation()}
                          >
                            <i className="bi bi-arrow-left-right"></i>
                          </Link>
                        ) : (
                          <span aria-hidden style={{ display: 'inline-block', width: 26 }} />
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {desk.hasMore && (
                <tr>
                  <td colSpan={20} style={{ padding: 0, border: 0 }}>
                    <div ref={desk.sentinelRef} style={{ height: 1 }} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MOBILE: redesigned player pool ═══ */}
        <div className="d-lg-none" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Sticky search + filter button */}
          <div className="kl-sticky-search">
            <div style={{ position: 'relative', flex: 1 }}>
              <i className="bi bi-search kl-sticky-search-icon"></i>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`kl-sticky-search-filter${activeFilterCount > 0 ? ' has-filters' : ''}`}
              onClick={() => setFilterOpen(true)}
            >
              <i className="bi bi-sliders2"></i>
              {activeFilterCount > 0 && (
                <span className="kl-sticky-search-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', flexShrink: 0 }}>
              {posFilter && <span className="kl-chip" onClick={() => setPosFilter('')}>{posFilter} <i className="bi bi-x kl-chip-remove"></i></span>}
              {ageFilter && <span className="kl-chip" onClick={() => setAgeFilter('')}>{ageFilter === '30+' ? '30+' : `U${ageFilter}`} <i className="bi bi-x kl-chip-remove"></i></span>}
              {statusFilter && <span className="kl-chip" onClick={() => setStatusFilter('')}>{statusFilter === 'available' ? 'Available' : 'Rostered'} <i className="bi bi-x kl-chip-remove"></i></span>}
              {teamFilter && <span className="kl-chip" onClick={() => setTeamFilter('')}>{teamFilter} <i className="bi bi-x kl-chip-remove"></i></span>}
              {ownerFilter && <span className="kl-chip" onClick={() => setOwnerFilter('')}>{ownerFilter} <i className="bi bi-x kl-chip-remove"></i></span>}
            </div>
          )}

          {/* Sort + count row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px', borderBottom: '1px solid rgba(55,51,48,.4)' }}>
            <span style={{ fontSize: '.72rem', color: '#80786f' }}><b style={{ color: '#a39586' }}>{mobileSorted.length}</b> players</span>
            <select
              className="form-select form-select-sm"
              value={mobSort}
              onChange={e => setMobSort(e.target.value as MobileSortKey)}
              style={{ background: 'transparent', border: 'none', color: '#f5b940', fontSize: '.72rem', fontWeight: 600, width: 'auto', padding: '2px 24px 2px 4px' }}
            >
              <option value="sc">SC Avg ↓</option>
              <option value="name_asc">Name A–Z</option>
              <option value="age">Youngest</option>
              <option value="rtg">Rating ↓</option>
              <option value="gp">Games ↓</option>
            </select>
          </div>

          {/* Player list — new card design */}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {mob.visible.map(p => {
              const positions = (p.position || 'MID').split('/')
              const tc = p.owner_team ? team_colours[p.owner_team] : null
              const l3Base = p.sc_avg || p.l3 || 0
              const l3Diff = (p.l3 || 0) - l3Base
              const l3Pct = l3Base ? (l3Diff / l3Base) * 100 : 0
              const trendUp = l3Pct > 5
              const trendDown = l3Pct < -5
              return (
                <div
                  key={p.id}
                  className="kl-player-card"
                  onClick={() => { window.location.href = `/player/${encodeURIComponent(p.name)}` }}
                  style={{ cursor: 'pointer' }}
                >
                  {p.afl_team && data.team_logos[p.afl_team] ? (
                    <img src={data.team_logos[p.afl_team]} alt="" className="kl-player-card-logo" />
                  ) : (
                    <div className="kl-player-card-logo-placeholder">
                      <i className="bi bi-shield-fill"></i>
                    </div>
                  )}
                  <div className="kl-player-card-body">
                    <div className="kl-player-card-name">
                      {p.name}
                      {p.is_new && <span className="pl-mark pl-mark-new">NEW</span>}
                      {p.is_former && <span className="pl-mark pl-mark-off">OFF AFL LIST</span>}
                      {p.on_block && <i className="bi bi-megaphone-fill pl-ico pl-ico-block"></i>}
                      {(p.note_count || 0) > 0 && <i className="bi bi-journal-text pl-ico"></i>}
                      {p.injury_severity && <i className="bi bi-bandaid-fill" style={{ color: '#f85149', fontSize: '.65rem', marginLeft: 4 }}></i>}
                    </div>
                    <div className="kl-player-card-meta">
                      {positions.map(pos => (
                        <span key={pos} className={`pos-badge badge-${pos.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`} style={{ fontSize: '.55rem', padding: '1px 5px', lineHeight: 1.3 }}>{pos}{p.position_expected ? ' exp' : ''}</span>
                      ))}
                      <span>{p.age}y</span>
                      <span>·</span>
                      <span>{p.games_played}gp</span>
                      {p.profile_tag && <span className={`profile-tag tag-${p.profile_css}`} style={{ fontSize: '.5rem', padding: '0 5px' }}>{p.profile_tag}</span>}
                    </div>
                  </div>
                  <div className="kl-player-card-right">
                    {p.sc_avg ? (
                      <span className="kl-player-card-sc">{Math.round(p.sc_avg)}{stats.tag && <small className="kl-yr-tag">{stats.tag}</small>}</span>
                    ) : (
                      <span className="kl-player-card-sc kl-player-card-sc-none">—</span>
                    )}
                    {trendUp && <span className="kl-player-card-trend kl-player-card-trend-up">▲ {Math.round(l3Pct)}%</span>}
                    {trendDown && <span className="kl-player-card-trend kl-player-card-trend-down">▼ {Math.round(Math.abs(l3Pct))}%</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        className={`wishlist-star${wishlist.isWishlisted(p.id) ? ' active' : ''}`}
                        onClick={e => { e.stopPropagation(); wishlist.toggle(p.id) }}
                        aria-label={wishlist.isWishlisted(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                      >
                        <i className={`bi ${wishlist.isWishlisted(p.id) ? 'bi-star-fill' : 'bi-star'}`}></i>
                      </button>
                      {p.owner_team ? (
                        <>
                          <span className="kl-player-card-owner" style={{ background: tc?.bg, color: tc?.fg }}>{p.owner_team}</span>
                          {p.owner_team !== leagueCtx?.user_team?.name && ownerNameToId.has(p.owner_team) && (
                            <Link
                              to={`/leagues/${leagueId}/trades/propose?with=${p.id}&from=${ownerNameToId.get(p.owner_team)}`}
                              className="trade-from-row"
                              title={`Propose trade for ${p.name} with ${p.owner_team}`}
                              aria-label={`Propose trade for ${p.name}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <i className="bi bi-arrow-left-right"></i>
                            </Link>
                          )}
                        </>
                      ) : can_pickup ? (
                        <button className="kl-player-card-add" onClick={e => { e.stopPropagation(); pickup(p.id) }} disabled={pickingUp === p.id}>
                          <i className="bi bi-plus"></i>
                        </button>
                      ) : (
                        <span className="kl-player-card-fa">FA</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {mob.hasMore && <div ref={mob.sentinelRef} style={{ height: 1 }} />}
            {mobileSorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#56504a' }}>
                <i className="bi bi-search" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}></i>
                <p style={{ fontSize: '.82rem', margin: 0 }}>No players match your filters</p>
              </div>
            )}
          </div>
        </div>

      {/* ═══ Filter Bottom Sheet (mobile only) ═══ */}
      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <div className="kl-filter-section">
          <div className="kl-filter-label">Quick filters</div>
          <div className="pf-smart pf-smart-sheet">
            {SMART_FILTERS.map(f => {
              if (f.key === 'mine' && !myTeam) return null
              const n = smartCounts[f.key] ?? 0
              const on = smart.has(f.key)
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`pf-chip pf-${f.tone}${on ? ' on' : ''}`}
                  onClick={() => toggleSmart(f.key)}
                  disabled={!on && n === 0}
                >
                  <i className={`bi ${f.icon}`} />
                  {f.label}
                  <span className="pf-chip-n">{n}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Position</div>
          <div className="kl-filter-options">
            {['', 'DEF', 'MID', 'FWD', 'RUC'].map(v => (
              <button key={v} type="button" className={`kl-filter-pill${posFilter === v ? ' active' : ''}`} onClick={() => setPosFilter(v)}>
                {v || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Age</div>
          <div className="kl-filter-options">
            {[['', 'All'], ['21', 'U21'], ['23', 'U23'], ['25', 'U25'], ['25-30', '25-30'], ['30+', '30+']].map(([v, label]) => (
              <button key={v} type="button" className={`kl-filter-pill${ageFilter === v ? ' active' : ''}`} onClick={() => setAgeFilter(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Status</div>
          <div className="kl-filter-options">
            {[['', 'All'], ['available', 'Available'], ['taken', 'Rostered']].map(([v, label]) => (
              <button key={v} type="button" className={`kl-filter-pill${statusFilter === v ? ' active' : ''}`} onClick={() => setStatusFilter(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">AFL Team</div>
          <select className="form-select form-select-sm" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}>
            <option value="">All Teams</option>
            {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Coach</div>
          <select className="form-select form-select-sm" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}>
            <option value="">All Coaches</option>
            {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="kl-filter-actions">
          <button type="button" className="kl-filter-btn-clear" onClick={clearFilters}>Clear All</button>
          <button type="button" className="kl-filter-btn-apply" onClick={() => setFilterOpen(false)}>Show {mobileSorted.length} Players</button>
        </div>
      </BottomSheet>
    </div>
  )
}
