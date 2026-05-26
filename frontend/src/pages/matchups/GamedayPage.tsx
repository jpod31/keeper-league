import { useParams, Link, useSearchParams } from 'react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'

interface Team { id: number; name: string; logo_url: string | null }
interface GDFixture { id: number; home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string; home_team: Team; away_team: Team }
interface GDPlayer {
  name: string; position: string; afl_team: string; player_id: number
  score: number; is_captain: boolean; is_vice_captain: boolean
  is_emergency: boolean; is_dnp: boolean; is_live: boolean
  lineup_type: string; game_started: boolean; subbed_on: boolean; replaces: string | null
}
interface AflGame { game_id: number; home_team: string; away_team: string; status: string; home_score: number | null; away_score: number | null; scheduled_display: string | null; scheduled_start: string | null }
interface Projections { my_projected: number; opp_projected: number; my_win_pct: number; opp_win_pct: number }
interface RoundScoreEntry {
  total_score?: number
  players_played?: number
  players_total?: number
  has_captain?: boolean
  captain_played?: boolean
  has_vc?: boolean
  vc_played?: boolean
}
interface GamedayData {
  is_bye: boolean; afl_round: number; round_dates: string | null; first_bounce: string | null
  gameday_state: string; live_enabled: boolean; is_home: boolean
  fixture: GDFixture; my_team: Team; opp_team: Team
  my_players: GDPlayer[]; opp_players: GDPlayer[]
  my_score: number; opp_score: number; my_captain_bonus: number; opp_captain_bonus: number
  my_played: number; my_eligible: number; opp_played: number; opp_eligible: number
  projections: Projections | null
  round_fixtures: GDFixture[]; round_scores: Record<string, RoundScoreEntry>
  afl_games: AflGame[]; locked_player_ids: number[]
  teams_playing: string[]; afl_matchup_info: Record<string, string>
  team_logos: Record<string, string>; team_abbr: Record<string, string>
}

// Stadium jewel-tone palette (same as Ladder/Shell — keeps team accents
// consistent across every page that paints with a team's colour).
const PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#3a7dc4', rgb: '58,125,196' },
  { hex: '#b87f3d', rgb: '184,127,61' },
  { hex: '#8a6db8', rgb: '138,109,184' },
  { hex: '#3d8c63', rgb: '61,140,99' },
  { hex: '#c2932f', rgb: '194,147,47' },
  { hex: '#b85a4a', rgb: '184,90,74' },
  { hex: '#3d8a9c', rgb: '61,138,156' },
  { hex: '#9d5878', rgb: '157,88,120' },
]
function accentFor(id: number | undefined | null) {
  const i = id ?? 0
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]
}

interface ClockState { tone: 'live' | 'upcoming' | 'done'; label: string; sub: string }
function deriveClock(d: GamedayData): ClockState {
  const games = d.afl_games || []
  const liveCount = games.filter(g => g.status === 'live').length
  const doneCount = games.filter(g => g.status === 'complete').length
  const total = games.length
  if (d.gameday_state === 'completed') {
    return { tone: 'done', label: 'FULL TIME', sub: total ? `${total}/${total} games` : 'Round complete' }
  }
  if (d.gameday_state === 'live') {
    return {
      tone: 'live',
      label: liveCount > 0 ? `LIVE · ${liveCount} ON` : 'BETWEEN GAMES',
      sub: `${doneCount}/${total} games done`,
    }
  }
  return { tone: 'upcoming', label: 'PRE-MATCH', sub: d.first_bounce ? `Bounce ${d.first_bounce}` : 'Awaiting first bounce' }
}

const GAMEDAY_CSS = `
/* === Gameday · Stadium broadcast =============================== */

/* Round header bar */
.gd-round-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; margin-bottom: 12px; background: rgba(15,22,36,.7); border: 1px solid rgba(110,130,180,.18); border-radius: 14px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.gd-round-title { font-size: 1rem; font-weight: 800; letter-spacing: .18em; color: #f0f4fc; margin: 0; text-transform: uppercase; }
.gd-round-dates { font-size: .68rem; color: #6c7892; margin-top: 3px; letter-spacing: .04em; }
.gd-round-state { display: inline-flex; align-items: center; gap: 10px; }

/* TV round clock */
.gd-clock { display: inline-flex; flex-direction: column; align-items: flex-end; padding: 5px 12px; border-radius: 10px; background: rgba(15,22,36,.55); border: 1px solid rgba(110,130,180,.22); position: relative; min-width: 118px; font-feature-settings: "tnum" 1, "zero" 0; }
.gd-clock.live { background: linear-gradient(135deg, rgba(61,140,99,.18), rgba(61,140,99,.04)); border-color: rgba(61,140,99,.45); box-shadow: 0 0 16px -4px rgba(61,140,99,.5); }
.gd-clock.upcoming { background: linear-gradient(135deg, rgba(58,125,196,.14), rgba(58,125,196,.03)); border-color: rgba(58,125,196,.35); }
.gd-clock-label { font-size: .7rem; font-weight: 800; letter-spacing: .16em; color: #f0f4fc; line-height: 1.1; }
.gd-clock.live .gd-clock-label { color: #7dc99a; }
.gd-clock.upcoming .gd-clock-label { color: #82b3e4; }
.gd-clock-sub { font-size: .56rem; color: #97a3ba; letter-spacing: .08em; margin-top: 3px; text-transform: uppercase; }
.gd-clock.live::before { content: ''; position: absolute; left: -1px; top: -1px; bottom: -1px; width: 3px; background: #6db38a; border-radius: 10px 0 0 10px; animation: gdPulse 1.8s ease-in-out infinite; }

.gd-refresh { all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; color: #97a3ba; background: rgba(255,255,255,.04); border: 1px solid rgba(110,130,180,.18); transition: color .14s, background .14s; }
.gd-refresh:hover { color: #dde4f1; background: rgba(255,255,255,.08); }
.gd-refresh:disabled { opacity: .4; cursor: wait; }

/* Comp toggle */
.gd-comp-toggle { display: inline-flex; background: rgba(15,22,36,.5); border: 1px solid rgba(110,130,180,.18); border-radius: 999px; padding: 3px; margin-bottom: 14px; }
.gd-comp-btn { padding: 6px 14px; border-radius: 999px; font-size: .74rem; font-weight: 700; color: #97a3ba; text-decoration: none; border: 0; background: transparent; cursor: pointer; }
.gd-comp-btn:hover { color: #dde4f1; text-decoration: none; }
.gd-comp-btn.active { background: rgba(58,125,196,.18); color: #82b3e4; }

/* AFL ticker — broadcast pills, wrap to fit every game on one panel */
.gd-ticker { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 14px; background: rgba(15,22,36,.6); border: 1px solid rgba(110,130,180,.16); border-radius: 12px; margin-bottom: 10px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.gd-ticker-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: rgba(20,28,45,.7); border: 1px solid rgba(110,130,180,.2); text-decoration: none; font-size: .72rem; color: #b6c0d3; font-variant-numeric: tabular-nums; transition: background .14s, border-color .14s; }
.gd-ticker-pill:hover { background: rgba(28,38,58,.85); border-color: rgba(110,130,180,.32); color: #dde4f1; text-decoration: none; }
.gd-ticker-dot { width: 7px; height: 7px; border-radius: 50%; background: #97a3ba; flex-shrink: 0; }
.gd-ticker-pill.live .gd-ticker-dot { background: #6db38a; box-shadow: 0 0 8px rgba(109,179,138,.6); animation: gdPulse 1.6s ease-in-out infinite; }
.gd-ticker-pill.upcoming .gd-ticker-dot { background: #82b3e4; }
.gd-ticker-pill.done .gd-ticker-dot { background: #5a677e; }
.gd-ticker-teams { font-weight: 600; color: #dde4f1; }
.gd-ticker-score { color: #97a3ba; font-size: .68rem; }
.gd-ticker-tag { font-size: .54rem; font-weight: 800; letter-spacing: .14em; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; }
.gd-ticker-pill.live .gd-ticker-tag { background: rgba(61,140,99,.22); color: #7dc99a; }
.gd-ticker-pill.upcoming .gd-ticker-tag { background: rgba(58,125,196,.18); color: #82b3e4; }
.gd-ticker-pill.done .gd-ticker-tag { background: rgba(110,130,180,.16); color: #97a3ba; }

/* KL mini bar — wrap all fixtures so none get hidden */
.gd-mini-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; padding: 10px 14px; background: rgba(15,22,36,.6); border: 1px solid rgba(110,130,180,.14); border-radius: 12px; margin-bottom: 12px; }
.gd-mini-pill { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 10px; border-radius: 10px; background: rgba(20,28,45,.5); border: 1px solid rgba(110,130,180,.18); cursor: pointer; transition: background .14s, border-color .14s, transform .14s; position: relative; }
.gd-mini-pill:hover { background: rgba(28,38,58,.8); border-color: rgba(110,130,180,.32); transform: translateY(-1px); }
.gd-mini-pill.yours::before { content: ''; position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: #82b3e4; box-shadow: 0 0 6px rgba(130,179,228,.6); }
.gd-mini-pill.active { border-color: rgba(58,125,196,.55); background: linear-gradient(135deg, rgba(58,125,196,.14), rgba(58,125,196,.03)); box-shadow: inset 0 0 0 1px rgba(58,125,196,.18); }
.gd-mini-teams { font-size: .7rem; font-weight: 700; color: #dde4f1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.gd-mini-score { font-size: .68rem; color: #97a3ba; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }

/* Hero — neutral scoreboard with deliberate accent placement.
   Team identity = LOGO + a top accent band split 50/50. Emphasis =
   the LEADING score is coloured in its team accent (loser stays
   muted). Colour appears where it carries meaning; never paints a
   whole panel. */
.gd-hero { position: relative; border-radius: 10px; overflow: hidden; margin-bottom: 14px; background: #0f1626; border: 1px solid rgba(110,130,180,.18); box-shadow: 0 12px 32px -10px rgba(0,0,0,.55); }

/* Top accent band — 5px stripe split 50/50 across both sides. Each
   half holds its team's accent. Clear team identifier per side at a
   glance. */
.gd-hero-band { height: 5px; display: grid; grid-template-columns: 1fr 1fr; }
.gd-hero-band-l { background: linear-gradient(90deg, var(--gd-left-accent, rgba(110,130,180,.5)) 0%, var(--gd-left-accent, rgba(110,130,180,.5)) 60%, color-mix(in srgb, var(--gd-left-accent, rgba(110,130,180,.5)) 60%, transparent) 100%); }
.gd-hero-band-r { background: linear-gradient(90deg, color-mix(in srgb, var(--gd-right-accent, rgba(110,130,180,.5)) 60%, transparent) 0%, var(--gd-right-accent, rgba(110,130,180,.5)) 40%, var(--gd-right-accent, rgba(110,130,180,.5)) 100%); }

.gd-hero-split { display: grid; grid-template-columns: 1fr 1fr; position: relative; }
.gd-hero-split::after { content: ''; position: absolute; top: 26px; bottom: 26px; left: 50%; width: 1px; background: linear-gradient(to bottom, transparent, rgba(110,130,180,.22), transparent); }

.gd-hero-side { padding: 26px 28px 22px; color: #f0f4fc; position: relative; min-height: 208px; display: flex; flex-direction: column; }
.gd-hero-side.right { text-align: right; align-items: flex-end; }
.gd-hero-side:not(.right) { align-items: flex-start; }

/* Top: crest + team name (tier 2 — team identity) */
.gd-hero-top { display: flex; align-items: center; gap: 14px; min-width: 0; max-width: 100%; }
.gd-hero-side.right .gd-hero-top { flex-direction: row-reverse; }

.gd-hero-crest { width: 56px; height: 56px; border-radius: 12px; background: rgba(20,28,45,.85); border: 2px solid var(--gd-side-accent, rgba(110,130,180,.4)); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; font-size: 1rem; font-weight: 900; letter-spacing: .04em; color: #f0f4fc; box-shadow: 0 6px 18px -6px rgba(0,0,0,.45); }
.gd-hero-crest img { width: 100%; height: 100%; object-fit: cover; display: block; }

.gd-hero-name { font-size: 1.05rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #f5f8ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; line-height: 1.15; }

/* Big score (tier 1 — eye lands here). Leading side gets coloured
   in its team accent + soft glow. Non-leading stays muted. */
.gd-hero-score-wrap { flex: 1; display: flex; align-items: center; padding: 16px 0 12px; }
.gd-hero-side:not(.right) .gd-hero-score-wrap { justify-content: flex-start; }
.gd-hero-side.right .gd-hero-score-wrap { justify-content: flex-end; }
.gd-hero-score { font-size: 5rem; font-weight: 900; line-height: .9; color: #6c7892; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; letter-spacing: -.05em; transition: color .35s, text-shadow .35s; }
.gd-hero-score.leading { color: var(--gd-side-hex, #f5f8ff); text-shadow: 0 0 32px rgba(var(--gd-side-rgb, 122,155,196), .45); }
.gd-hero-score.pre { color: #38415a; }

.gd-hero-meta { display: flex; align-items: center; gap: 8px; font-size: .68rem; color: #97a3ba; letter-spacing: .04em; min-height: 20px; }
.gd-hero-side.right .gd-hero-meta { justify-content: flex-end; }
.gd-hero-played { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.gd-cap-bonus { font-size: .64rem; font-weight: 700; color: #f0d27a; letter-spacing: .06em; white-space: nowrap; }

/* C/VC badges */
.gd-role-badge { font-size: .54rem; font-weight: 800; letter-spacing: .1em; padding: 2px 6px; border-radius: 3px; color: #6c7892; background: rgba(110,130,180,.08); border: 1px solid rgba(110,130,180,.18); }
.gd-role-badge.active { color: #f0d27a; background: rgba(194,147,47,.16); border-color: rgba(194,147,47,.36); }
.gd-role-badge.active.vc { color: #82b3e4; background: rgba(58,125,196,.16); border-color: rgba(58,125,196,.36); }

/* "YOU" pin — friendly sapphire, only on user's side */
.gd-hero-you { position: absolute; top: 12px; right: 14px; z-index: 2; font-size: .54rem; font-weight: 800; letter-spacing: .16em; color: #a8c8ed; padding: 2px 8px; background: rgba(58,125,196,.14); border: 1px solid rgba(58,125,196,.4); border-radius: 3px; }
.gd-hero-side.right .gd-hero-you { left: 14px; right: auto; }

/* Bottom strip — state-aware. Pre-match: no margin chip, just bounce
   time + projection. Live: margin chip + projection. Done: margin
   chip + breakdown link. */
.gd-hero-strip { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 12px 18px; background: rgba(11,16,28,.6); border-top: 1px solid rgba(110,130,180,.1); flex-wrap: wrap; }
.gd-margin-chip { display: inline-flex; align-items: center; gap: 7px; padding: 5px 14px; border-radius: 4px; font-size: .82rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #f0f4fc; background: rgba(255,255,255,.04); border: 1px solid rgba(110,130,180,.18); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }
.gd-margin-chip.win { color: #7dc99a; background: rgba(61,140,99,.14); border-color: rgba(61,140,99,.4); }
.gd-margin-chip.loss { color: #e07a6c; background: rgba(184,90,74,.14); border-color: rgba(184,90,74,.4); }
.gd-margin-chip.up { color: #7dc99a; background: rgba(61,140,99,.1); border-color: rgba(61,140,99,.3); }
.gd-margin-chip.down { color: #e07a6c; background: rgba(184,90,74,.1); border-color: rgba(184,90,74,.3); }

.gd-proj-row { display: flex; align-items: center; gap: 12px; font-size: .68rem; color: #97a3ba; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }
.gd-proj-item b { font-weight: 700; color: #dde4f1; }
.gd-proj-sep { width: 3px; height: 3px; border-radius: 50%; background: rgba(110,130,180,.4); }

.gd-first-bounce { display: inline-flex; align-items: center; gap: 6px; font-size: .82rem; color: #dde4f1; font-weight: 700; letter-spacing: .04em; padding: 5px 14px; border-radius: 4px; background: rgba(58,125,196,.08); border: 1px solid rgba(58,125,196,.22); }
.gd-first-bounce i { color: #82b3e4; }
.gd-breakdown-link { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 4px; font-size: .72rem; font-weight: 700; color: #82b3e4; text-decoration: none; background: rgba(58,125,196,.14); border: 1px solid rgba(58,125,196,.32); transition: background .14s; }
.gd-breakdown-link:hover { background: rgba(58,125,196,.22); color: #a8c8ed; text-decoration: none; }

/* Score flash */
.score-flash { animation: gdScoreFlash 1.4s ease-out; }
@keyframes gdScoreFlash { 0% { transform: scale(1.18); filter: brightness(1.4); } 35% { transform: scale(.96); } 100% { transform: scale(1); filter: brightness(1); } }
@keyframes gdPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

/* Player card column */
.gd-pcard { background: rgba(15,22,36,.7); border: 1px solid rgba(110,130,180,.16); border-radius: 14px; overflow: hidden; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.gd-pcard-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(20,28,45,.6); border-bottom: 1px solid rgba(110,130,180,.12); }
.gd-pcard-name { font-size: .82rem; font-weight: 800; color: #f0f4fc; letter-spacing: -.01em; }
.gd-pcard-total { font-size: 1.1rem; font-weight: 800; color: #f5f8ff; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }

.gd-section { display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: .58rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #6c7892; background: rgba(11,16,28,.55); border-bottom: 1px solid rgba(110,130,180,.08); border-left: 2px solid transparent; }
.gd-section.field { border-left-color: rgba(61,140,99,.55); color: #7dc99a; background: rgba(61,140,99,.05); }
.gd-section.bench { border-left-color: rgba(58,125,196,.45); color: #82b3e4; }
.gd-section.emergency { border-left-color: rgba(194,147,47,.5); color: #c2932f; background: rgba(194,147,47,.04); }
.gd-section.dnp { border-left-color: rgba(184,90,74,.45); color: #d68a7e; }
.gd-section.nogame { color: #6c7892; }

/* Player row — broadcast tile */
.gd-prow { display: grid; grid-template-columns: 38px 1fr auto; gap: 10px; align-items: center; padding: 9px 14px; border-bottom: 1px solid rgba(110,130,180,.06); transition: background .14s; }
.gd-prow:last-child { border-bottom: none; }
.gd-prow:hover { background: rgba(28,38,58,.45); }

.gd-pos { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 22px; border-radius: 5px; font-size: .56rem; font-weight: 800; letter-spacing: .06em; background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3; }
.gd-pos.def { background: rgba(61,138,156,.14); color: #7ec0d3; border-color: rgba(61,138,156,.3); }
.gd-pos.mid { background: rgba(58,125,196,.14); color: #82b3e4; border-color: rgba(58,125,196,.3); }
.gd-pos.ruc { background: rgba(138,109,184,.14); color: #b39ed4; border-color: rgba(138,109,184,.3); }
.gd-pos.fwd { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.3); }

.gd-pbody { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gd-prow-name { display: flex; align-items: center; gap: 5px; min-width: 0; }
.gd-pname { font-size: .82rem; font-weight: 600; color: #dde4f1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gd-pfix { display: flex; align-items: center; gap: 4px; font-size: .62rem; color: #6c7892; }
.gd-pfix img { width: 12px; height: 12px; }

.gd-pbadge { font-size: .52rem; font-weight: 800; letter-spacing: .06em; padding: 1px 4px; border-radius: 3px; line-height: 1.3; flex-shrink: 0; }
.gd-pbadge.c { background: rgba(194,147,47,.2); color: #f0d27a; border: 1px solid rgba(194,147,47,.4); }
.gd-pbadge.vc { background: rgba(58,125,196,.2); color: #82b3e4; border: 1px solid rgba(58,125,196,.4); }
.gd-pbadge.emg { background: rgba(184,90,74,.16); color: #e07a6c; border: 1px solid rgba(184,90,74,.36); }
.gd-pbadge.emg-active { background: rgba(58,125,196,.2); color: #82b3e4; border: 1px solid rgba(58,125,196,.4); }
.gd-pbadge.dnp { background: rgba(110,130,180,.12); color: #97a3ba; }

.gd-pscore { font-size: .98rem; font-weight: 800; color: #f0f4fc; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; display: inline-flex; align-items: center; gap: 5px; min-width: 36px; justify-content: flex-end; }
.gd-pscore.live { color: #7dc99a; }
.gd-pscore.live::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #6db38a; box-shadow: 0 0 6px rgba(109,179,138,.7); animation: gdPulse 1.6s ease-in-out infinite; }
.gd-pscore.ytp { color: #5a677e; animation: gdPulse 2.4s ease-in-out infinite; }
.gd-pscore.dnp { color: #5a677e; }
.gd-pscore.muted { color: #38415a; }

.gd-prow.locked .gd-pname { color: #97a3ba; }
.gd-prow.dnp { opacity: .65; }
.gd-prow.dnp .gd-pname { color: #6c7892; }
.gd-prow.reserve { opacity: .55; }
.gd-prow.emg-standby { opacity: .65; }
.gd-prow.emg-standby .gd-pname { color: #c2932f; }
.gd-prow.subbed-on { background: rgba(61,140,99,.05); }

.gd-sub-note { font-size: .58rem; color: #6c7892; font-style: italic; margin-left: 4px; }

/* Footer */
.gd-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 0 4px; font-size: .68rem; color: #6c7892; }
.gd-foot a { color: #97a3ba; text-decoration: none; font-size: .7rem; }
.gd-foot a:hover { color: #82b3e4; }

/* BYE state */
.gd-bye { text-align: center; padding: 50px 24px; background: rgba(15,22,36,.6); border: 1px solid rgba(110,130,180,.16); border-radius: 18px; }
.gd-bye h4 { color: #dde4f1; font-size: 1.1rem; font-weight: 700; margin: 0 0 6px; }
.gd-bye p { font-size: .85rem; color: #6c7892; margin: 0; }

/* Mobile side-by-side (preserved from legacy) */
.gameday-round-header { margin-bottom: 10px; }
.gameday-round-title { font-size: 1.4rem; font-weight: 800; letter-spacing: 1px; color: var(--kl-text-heading); }
.gameday-round-dates { color: var(--kl-text-secondary); font-size: .8rem; }
.gameday-state-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; font-weight: 700; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; letter-spacing: .5px; }
.badge-upcoming { background: rgba(31,111,235,.12); color: var(--kl-accent-blue); border: 1px solid rgba(31,111,235,.25); }
.badge-live { background: rgba(35,134,54,.15); color: #3fb950; border: 1px solid rgba(35,134,54,.3); }
.badge-final { background: var(--kl-bg-elevated); color: var(--kl-text-primary); }
.badge-bye { background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.live-pulse-dot { display: inline-block; width: 7px; height: 7px; background: #3fb950; border-radius: 50%; animation: liveDotGlow 2s ease-in-out infinite; }
@keyframes liveDotGlow { 0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(63,185,80,.4); } 50% { opacity: .4; box-shadow: 0 0 10px rgba(63,185,80,.8), 0 0 20px rgba(63,185,80,.3); } }
.gameday-afl-bar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 12px; padding: 10px 14px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; }
.game-status-pill { display: inline-flex; align-items: center; gap: 6px; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 16px; padding: 4px 10px; font-size: .72rem; text-decoration: none; color: inherit; }
.game-teams { color: var(--kl-text-primary); font-weight: 600; }
.game-afl-score { color: var(--kl-text-secondary); font-size: .7rem; font-variant-numeric: tabular-nums; }
.game-badge-live { font-size: .6rem; background: #238636; color: #fff; animation: pulse 2s infinite; }
.game-badge-ft { font-size: .6rem; background: #238636; color: #fff; }
.game-badge-sched { font-size: .6rem; background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.kl-mini-bar { display: flex; gap: 6px; margin-bottom: 8px; padding: 10px 14px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; }
.kl-mini-pill { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 10px; cursor: pointer; transition: border-color .15s, background .15s; text-align: center; }
.kl-mini-pill:hover { background: var(--kl-bg-elevated); border-color: var(--kl-border-light); }
.kl-mini-yours { border-color: var(--kl-accent-blue); }
.kl-mini-teams { font-weight: 600; font-size: .72rem; color: var(--kl-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.kl-mini-score { font-size: .68rem; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; }
.gameday-hero { background: radial-gradient(ellipse at 50% 0%, rgba(22,27,34,.95) 0%, var(--kl-bg-card) 70%); border: 1px solid var(--kl-border); border-radius: 16px; padding: 0; margin-bottom: 4px; position: relative; overflow: hidden; }
.gameday-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 2; }
.hero-live { border-color: rgba(35,134,54,.35); animation: glowPulse 4s ease-in-out infinite; }
.hero-live::before { background: linear-gradient(90deg, #238636, #3fb950, #238636); background-size: 200% 100%; animation: heroShimmer 3s linear infinite; }
.hero-completed { border-color: rgba(139,148,158,.2); }
.hero-completed::before { background: linear-gradient(90deg, rgba(139,148,158,.3), rgba(139,148,158,.6), rgba(139,148,158,.3)); }
.hero-upcoming { border-color: rgba(31,111,235,.2); }
.hero-upcoming::before { background: linear-gradient(90deg, #1f6feb, #58a6ff, #1f6feb); background-size: 200% 100%; animation: heroShimmer 4s linear infinite; }
@keyframes heroShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes glowPulse { 0%, 100% { box-shadow: 0 0 20px rgba(35,134,54,.1); } 50% { box-shadow: 0 0 30px rgba(35,134,54,.15); } }
.hero-teams-row { display: flex; align-items: center; justify-content: center; padding: 20px 20px 0; gap: 0; }
.hero-team-block { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.hero-team-right { justify-content: flex-end; }
.hero-team-detail { min-width: 0; flex: 1; }
.hero-vs { font-size: .6rem; font-weight: 800; color: var(--kl-text-faint); letter-spacing: 2px; padding: 0 14px; opacity: .5; flex-shrink: 0; }
.hero-crest { display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 14px; font-weight: 800; font-size: 1rem; letter-spacing: .5px; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.left-initial { background: linear-gradient(145deg, #0d3618, #238636, #3fb950); color: #fff; }
.right-initial { background: linear-gradient(145deg, #2d1060, #5a2d9e, #bc8cff); color: #fff; }
.hero-crest-img { width: 50px; height: 50px; border-radius: 14px; object-fit: cover; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); border: 2px solid rgba(255,255,255,.08); }
.hero-team-name { color: var(--kl-text-heading); font-weight: 700; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.hero-team-meta { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.hero-players-count { font-size: .64rem; color: var(--kl-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; }
.hero-cap-badges { display: flex; gap: 2px; }
.hero-role-badge { font-size: .5rem; padding: 1px 4px; border-radius: 3px; font-weight: 700; background: rgba(139,148,158,.12); color: #6e7681; line-height: 1.3; }
.hero-role-badge.role-active { background: rgba(63,185,80,.18); color: #3fb950; }
.hero-scores-area { display: flex; align-items: flex-start; justify-content: center; gap: 10px; padding: 18px 20px 16px; }
.hero-score-col { display: flex; flex-direction: column; align-items: center; min-width: 70px; }
.hero-big-score { font-size: 3.4rem; font-weight: 900; line-height: 1; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; transition: color .4s, text-shadow .4s; }
.hero-big-score.score-winning { color: #3fb950; text-shadow: 0 0 28px rgba(63,185,80,.4), 0 0 56px rgba(63,185,80,.15); }
.hero-score-dash { font-size: 2.2rem; font-weight: 300; color: var(--kl-text-faint); line-height: 1; padding-top: 8px; opacity: .4; }
.captain-bonus { color: #d29922; font-size: .65rem; font-weight: 700; margin-top: 3px; white-space: nowrap; }
.hero-footer { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid rgba(139,148,158,.06); }
.hero-margin-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 16px; border-radius: 8px; font-size: .72rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--kl-text-primary); background: rgba(139,148,158,.08); }
.hero-margin-chip i { font-size: .6rem; }
.hero-proj-row { display: flex; align-items: center; gap: 10px; }
.hero-proj-item { font-size: .66rem; color: var(--kl-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hero-proj-item b { font-weight: 700; color: var(--kl-text-secondary); }
.hero-proj-sep { width: 1px; height: 12px; background: rgba(139,148,158,.2); flex-shrink: 0; }
.hero-first-bounce { text-align: center; padding: 0 20px 12px; color: var(--kl-text-secondary); font-size: .8rem; }
.hero-breakdown-wrap { text-align: center; padding: 0 20px 14px; }
.hero-breakdown-link { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; font-weight: 600; color: var(--kl-accent-blue); text-decoration: none; padding: 5px 14px; border-radius: 8px; border: 1px solid rgba(88,166,255,.2); background: rgba(88,166,255,.06); transition: background .15s; }
.hero-breakdown-link:hover { background: rgba(88,166,255,.12); }
.gameday-player-card { background: var(--kl-bg-body); border: 1px solid var(--kl-bg-elevated); border-radius: 10px; overflow: hidden; }
.card-left-team { border-left: 3px solid var(--kl-accent-green); }
.card-right-team { border-left: 3px solid var(--kl-text-muted); }
.gameday-player-card-header { background: var(--kl-bg-card); padding: 10px 14px; font-weight: 600; font-size: .85rem; color: var(--kl-text-primary); border-bottom: 1px solid var(--kl-bg-elevated); display: flex; justify-content: space-between; align-items: center; }
.gameday-card-score { font-weight: 800; font-size: .95rem; color: var(--kl-text-heading); font-variant-numeric: tabular-nums; }
.gameday-player-list { max-height: 600px; overflow-y: auto; }
.gameday-player-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 14px; border-bottom: 1px solid var(--kl-bg-card); font-size: .8rem; transition: background .15s; }
.gameday-player-row:last-child { border-bottom: none; }
.gameday-player-row:hover { background: var(--kl-bg-card); }
.gameday-player-row:hover .gameday-player-name { color: var(--kl-accent-blue); }
.player-locked { position: relative; }
.player-locked::before {
  content: '';
  position: absolute;
  left: 0; top: 10%; bottom: 10%;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(to bottom, rgba(139,148,158,.15), rgba(139,148,158,.45), rgba(139,148,158,.15));
}
.player-locked .gameday-player-name { color: var(--kl-text-secondary); }
.gameday-player-info { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
.gameday-player-name { color: var(--kl-text-primary); white-space: nowrap; }
.gameday-player-meta { color: var(--kl-text-faint); font-size: .7rem; white-space: nowrap; }
.gameday-player-score { font-weight: 600; white-space: nowrap; color: var(--kl-text-primary); font-variant-numeric: tabular-nums; }
.gameday-live-dot { font-size: .35rem; color: #56d364; vertical-align: middle; margin-left: 3px; animation: pulse 2s infinite; }
.gameday-player-score.text-success { color: #56d364 !important; }
.gameday-team-logo { width: 16px; height: 16px; vertical-align: middle; margin-right: 2px; }
.gameday-pos-badge { padding: 1px 5px !important; font-size: .55rem !important; border-radius: 3px !important; line-height: 1.4; }
.gameday-badge-c { display: inline-block; background: var(--kl-accent-yellow); color: #000; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-vc { display: inline-block; background: var(--kl-accent-blue); color: #000; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-emg { display: inline-block; background: var(--kl-accent-red); color: #fff; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-dnp { display: inline-block; background: var(--kl-text-faint); color: var(--kl-text-primary); font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-emg-active { background: rgba(59,130,246,.18); color: #60a5fa; border: 1px solid rgba(59,130,246,.3); font-size: .55rem; font-weight: 800; padding: 1px 5px; border-radius: 3px; letter-spacing: .3px; margin-right: 3px; }
.gameday-sub-note { font-size: .62rem; color: #8b949e; font-style: italic; }
.player-dnp { opacity: 0.75; }
.player-dnp .gameday-player-name { color: #8b949e; }
.score-dnp { color: #6e7681 !important; }
.player-emergency-standby { opacity: 0.6; }
.player-emergency-standby .gameday-player-name { color: #d29922; }
.score-emg-standby { color: var(--kl-border) !important; }
.player-subbed-on { background: rgba(35,134,54,.08); }
.player-reserve { opacity: 0.5; }
.player-reserve .gameday-player-name { color: var(--kl-text-faint); }
.score-reserve { color: var(--kl-border) !important; }
.player-yet-to-play .gameday-player-score { color: var(--kl-text-muted); }
.score-ytp { color: var(--kl-text-muted) !important; }
@keyframes ytpPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
.player-yet-to-play .gameday-player-score { animation: ytpPulse 2s ease-in-out infinite; }
.gameday-section-hdr { padding: 6px 14px; font-size: .65rem; font-weight: 700; color: var(--kl-text-secondary); text-transform: uppercase; letter-spacing: .5px; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-bg-elevated); border-left: 3px solid transparent; }
.section-field { border-left-color: var(--kl-accent-green); background: rgba(63,185,80,.04); }
.section-bench { border-left-color: var(--kl-accent-blue); }
.section-emergency { border-left-color: #d29922; color: #d29922; background: rgba(210,153,34,.06); }
.section-dnp { color: #f85149; }
.gameday-all-matchups { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 12px; overflow: hidden; }
.gameday-matchups-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-size: .75rem; font-weight: 700; color: var(--kl-text-secondary); text-transform: uppercase; letter-spacing: .8px; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-border); }
.matchups-header-dates { font-size: .7rem; font-weight: 500; color: var(--kl-text-faint); text-transform: none; letter-spacing: normal; }
.gameday-matchups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 14px; }
.gameday-matchup-card { display: block; text-decoration: none; color: inherit; cursor: pointer; background: var(--kl-bg-body); border: 1px solid var(--kl-bg-elevated); border-radius: 8px; padding: 12px 14px; position: relative; transition: transform .15s, border-color .15s, box-shadow .15s; }
.gameday-matchup-card:hover { transform: translateY(-2px); border-color: var(--kl-border-light); box-shadow: 0 4px 12px rgba(0,0,0,.3); }
.matchup-yours { border-color: var(--kl-accent-blue) !important; background: rgba(31,111,235,.04); }
.matchup-your-tag { position: absolute; top: -1px; right: 10px; font-size: .55rem; font-weight: 700; text-transform: uppercase; color: var(--kl-accent-blue); background: rgba(31,111,235,.15); padding: 2px 8px; border-radius: 0 0 6px 6px; letter-spacing: .3px; }
.matchup-team-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: .8rem; }
.matchup-team-name { color: var(--kl-text-primary); font-weight: 500; }
.matchup-winner { color: var(--kl-text-heading); font-weight: 700; }
.matchup-team-score { font-weight: 700; font-size: .85rem; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 3px; }
.matchup-mini-bar { height: 4px; background: var(--kl-accent-red); border-radius: 2px; overflow: hidden; margin-top: 8px; opacity: 0.6; }
.matchup-mini-fill { height: 100%; background: var(--kl-accent-green); border-radius: 2px; transition: width .6s ease; }
.matchup-margin { font-size: .65rem; color: var(--kl-text-muted); text-align: center; margin-top: 4px; font-variant-numeric: tabular-nums; }
.score-flash { animation: scorePopIn 1.5s ease-out; }
@keyframes scorePopIn { 0% { transform: scale(1.15); color: var(--kl-accent-blue); text-shadow: 0 0 8px rgba(88,166,255,.5); } 40% { transform: scale(.97); } 100% { transform: scale(1); color: inherit; text-shadow: none; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.gd-mob-section-hdr { padding: 6px 10px; font-size: .68rem; font-weight: 700; color: #58a6ff; text-transform: uppercase; letter-spacing: .5px; background: rgba(88,166,255,.05); border-bottom: 1px solid rgba(48,54,61,.3); }
@media (max-width: 767.98px) {
  /* Hero — slim down for mobile */
  .gd-hero-side { padding: 16px 16px 14px; min-height: 158px; }
  .gd-hero-top { gap: 10px; }
  .gd-hero-crest { width: 44px; height: 44px; border-radius: 10px; font-size: .82rem; border-width: 2px; }
  .gd-hero-name { font-size: .82rem; letter-spacing: .03em; }
  .gd-hero-score-wrap { padding: 10px 0 8px; }
  .gd-hero-score { font-size: 3rem; letter-spacing: -.04em; }
  .gd-hero-meta { font-size: .58rem; gap: 5px; }
  .gd-cap-bonus { font-size: .56rem; }
  .gd-hero-strip { padding: 10px 14px; gap: 8px; font-size: .68rem; }
  .gd-margin-chip { font-size: .7rem; padding: 4px 11px; }
  .gd-first-bounce { font-size: .72rem; padding: 4px 11px; }
  .gd-proj-row { gap: 8px; font-size: .62rem; }
  .gd-hero-you { font-size: .48rem; padding: 2px 6px; top: 10px; right: 12px; }
  .gd-hero-side.right .gd-hero-you { left: 12px; right: auto; }

  /* Legacy classes (kept harmless for any straggling Jinja paths) */
  .gameday-hero { border-radius: 16px; margin: 0 -4px 8px; }
  .hero-teams-row { padding: 16px 14px 0; }
  .hero-big-score { font-size: 2.8rem; min-width: 55px; letter-spacing: -.04em; }
  .hero-score-dash { font-size: 1.4rem; padding-top: 8px; opacity: .3; }
  .hero-scores-area { padding: 16px 14px 14px; }
  .hero-team-name { font-size: .82rem; font-weight: 800; }
  .hero-crest { width: 44px; height: 44px; font-size: .9rem; border-radius: 12px; }
  .hero-crest-img { width: 44px; height: 44px; border-radius: 12px; }
  .hero-team-block { gap: 10px; }
  .hero-vs { padding: 0 6px; font-size: .5rem; opacity: .4; }
  .hero-footer { padding: 10px 14px 14px; gap: 6px; }
  .hero-margin-chip { font-size: .68rem; padding: 5px 14px; border-radius: 10px; }
  .gameday-player-row { padding: 8px 12px; font-size: .78rem; border-bottom: 1px solid rgba(48,54,61,.2); }
  .gameday-player-row:last-child { border-bottom: none; }
  .gameday-player-meta { display: none; }
  .gameday-player-name { font-weight: 700; color: #e6edf3; }
  .gameday-player-score { font-weight: 800; font-size: .88rem; font-variant-numeric: tabular-nums; }
  .gameday-round-title { font-size: 1rem; font-weight: 800; letter-spacing: -.01em; }
  .gameday-matchups-grid { grid-template-columns: 1fr; gap: 8px; padding: 10px; }
  .gameday-pos-badge { display: none !important; }
  .gameday-section-hdr { font-size: .6rem; padding: 5px 12px; letter-spacing: .8px; }
  .gameday-player-card-header { padding: 8px 12px; font-size: .82rem; font-weight: 800; }
  .kl-mini-bar { gap: 4px; padding: 8px 10px; border-radius: 12px; margin-bottom: 8px; }
  .kl-mini-pill { font-size: .68rem; padding: 6px 10px; border-radius: 8px; }
  .kl-mini-yours { border-color: rgba(88,166,255,.3); box-shadow: 0 0 0 1px rgba(88,166,255,.15) inset; }
  .comp-toggle { margin-bottom: 8px; }
  .comp-toggle-btn { font-size: .72rem; padding: 6px 16px; }
}
`

// Fixture data from the API (for matchup switching)
interface FixtureDetail {
  fixture_id: number
  home_score: number; away_score: number
  home_captain_bonus: number; away_captain_bonus: number
  home_players: GDPlayer[]; away_players: GDPlayer[]
  projections: { home_projected: number; away_projected: number; home_win_pct: number; away_win_pct: number } | null
}

export function GamedayPage() {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const urlFixtureId = searchParams.get('fixture')
  const urlRound = searchParams.get('round')
  const [data, setData] = useState<GamedayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewedFixtureId, setViewedFixtureId] = useState<number | null>(
    urlFixtureId ? Number(urlFixtureId) : null
  )
  const [cachedFixtures, setCachedFixtures] = useState<Record<number, FixtureDetail>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [scoreFlash, setScoreFlash] = useState(false)
  const prevScores = useRef<{ left: number; right: number }>({ left: 0, right: 0 })

  const fetchData = useCallback(() => {
    const qs = urlRound ? `&round=${urlRound}` : ''
    api<GamedayData>(`/leagues/${leagueId}/gameday?format=json${qs}`)
      .then(d => {
        setData(d)
        // Set initial viewed fixture: URL param takes precedence, otherwise user's own
        if (!viewedFixtureId && d.fixture) setViewedFixtureId(d.fixture.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, urlRound])

  // Fetch all fixture breakdowns (for switching between matchups)
  const fetchAllFixtures = useCallback(() => {
    if (!data) return
    api<{ fixtures: FixtureDetail[]; locked_player_ids: number[] }>(
      `/leagues/${leagueId}/gameday/api/fixtures?round=${data.afl_round}`
    ).then(d => {
      const cache: Record<number, FixtureDetail> = {}
      d.fixtures?.forEach(f => { cache[f.fixture_id] = f })
      setCachedFixtures(cache)
    }).catch(() => {})
  }, [leagueId, data?.afl_round])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Respond to URL fixture query param (e.g. user clicks a fixture row from FixturePage)
  useEffect(() => {
    if (urlFixtureId) setViewedFixtureId(Number(urlFixtureId))
  }, [urlFixtureId])

  // Auto-reload every 5min when live
  useEffect(() => {
    if (data?.gameday_state === 'live') {
      // removed: 5min auto-reload was destroying SPA state. fetchData() already runs every 60s.
      return undefined
    }
  }, [data?.gameday_state])

  // WebSocket live scoring — silent (no banner). Socket.IO handles reconnect
  // internally; we just sit quietly and keep cachedFixtures up to date.
  const socketRef = useRef<Socket | null>(null)
  const lastSeq = useRef(0)
  const shouldConnect = data?.gameday_state === 'live' && !!data?.live_enabled
  const afl_round = data?.afl_round

  useEffect(() => {
    if (!shouldConnect) return

    const socket = io('/matchups', {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_live', { league_id: Number(leagueId), afl_round })
      socket.emit('request_scores', { league_id: Number(leagueId), afl_round })
    })

    socket.on('score_update', (update: { fixtures?: FixtureDetail[]; seq?: number }) => {
      if (update.seq && update.seq <= lastSeq.current) return
      if (update.seq) lastSeq.current = update.seq

      if (update.fixtures) {
        setCachedFixtures(prev => {
          const next = { ...prev }
          update.fixtures!.forEach(f => { next[f.fixture_id] = f })
          return next
        })
      }
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [leagueId, shouldConnect, afl_round])

  // Pre-fetch all fixture breakdowns once data is loaded
  const hasFetched = useRef(false)
  useEffect(() => {
    if (data && !hasFetched.current) {
      hasFetched.current = true
      fetchAllFixtures()
    }
  }, [data, fetchAllFixtures])

  const viewMatchup = useCallback((fixtureId: number) => {
    setViewedFixtureId(fixtureId)
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await api(`/leagues/${leagueId}/gameday/sync-scores`, { method: 'POST' }).catch(() => {})
      fetchData()
    } finally {
      setTimeout(() => setRefreshing(false), 1000)
    }
  }, [leagueId, fetchData])

  // 5min poll when upcoming — check if games went live
  useEffect(() => {
    if (data?.gameday_state !== 'upcoming') return
    const timer = setInterval(() => {
      api<{ game_statuses?: { status: string }[] }>(`/leagues/${leagueId}/gameday/api/fixtures?round=${data.afl_round}`)
        .then(_d => {
          // Live score updates handled by fetchData() interval
        }).catch(() => {})
    }, 300000)
    return () => clearInterval(timer)
  }, [data?.gameday_state, data?.afl_round, leagueId])

  if (loading) return <Spinner text="Loading gameday..." />
  if (!data) return <p className="text-danger">Failed to load gameday</p>

  // Helper: count players played/eligible from player array.
  // Mirrors the Jinja client-side _countPlayers (which counts field + bench scoring
  // types and uses game_started && (score > 0 || is_dnp) as the "played" test).
  // Only used when we have to derive counts ourselves (switched matchups with no
  // round_scores entry) — for own matchup we prefer the authoritative my_played/my_eligible.
  const teamsPlayingSet = new Set(data.teams_playing || [])
  function countPlayed(players: GDPlayer[]): { played: number; total: number } {
    const scoringTypes = new Set(['field', 'reserve'])
    const eligible = players.filter(p => scoringTypes.has(p.lineup_type) && (teamsPlayingSet.size === 0 || teamsPlayingSet.has(p.afl_team)))
    const played = eligible.filter(p => p.game_started && ((p.score || 0) > 0 || p.is_dnp)).length
    return { played, total: eligible.length }
  }

  // Helper: derive C/VC badge status from player array when no round_scores entry is available
  // (matches the Jinja client-side JS _capVcStatus: game_started && (score > 0 || is_dnp)).
  // When round_scores IS available, CapBadges prefers the authoritative played_set-derived value.
  function capVcStatus(players: GDPlayer[]): { hasCap: boolean; capPlayed: boolean; hasVc: boolean; vcPlayed: boolean } {
    let hasCap = false, capPlayed = false, hasVc = false, vcPlayed = false
    players.forEach(p => {
      const playedThisRound = p.game_started && ((p.score || 0) > 0 || p.is_dnp)
      if (p.is_captain) { hasCap = true; capPlayed = playedThisRound }
      if (p.is_vice_captain) { hasVc = true; vcPlayed = playedThisRound }
    })
    return { hasCap, capPlayed, hasVc, vcPlayed }
  }

  // CapBadges: prefer authoritative round_scores entry (from backend played_set) when supplied,
  // otherwise fall back to scanning the player array (used when viewing other matchups via cached fixture data).
  function CapBadges({ players, rs }: { players: GDPlayer[]; rs?: RoundScoreEntry }) {
    const s = rs && rs.has_captain !== undefined
      ? { hasCap: !!rs.has_captain, capPlayed: !!rs.captain_played, hasVc: !!rs.has_vc, vcPlayed: !!rs.vc_played }
      : capVcStatus(players)
    return (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {s.hasCap && <span className={`gd-role-badge${s.capPlayed ? ' active' : ''}`}>C</span>}
        {s.hasVc && <span className={`gd-role-badge vc${s.vcPlayed ? ' active' : ''}`}>VC</span>}
      </span>
    )
  }

  const d = data
  const gs = d.gameday_state
  const isViewingOwn = !viewedFixtureId || viewedFixtureId === d.fixture?.id

  // Determine what data to show in the hero/player cards
  let heroLeftName: string, heroRightName: string
  let heroLeftScore: number, heroRightScore: number
  let heroLeftCapBonus: number, heroRightCapBonus: number
  let heroLeftPlayers: GDPlayer[], heroRightPlayers: GDPlayer[]
  let heroLeftLogo: string | null | undefined, heroRightLogo: string | null | undefined
  let heroLeftRs: RoundScoreEntry | undefined, heroRightRs: RoundScoreEntry | undefined
  let heroLeftTeamId: number | undefined, heroRightTeamId: number | undefined
  // Projection in left/right orientation — must follow the viewed matchup, not d.projections.
  let heroProjLeft: number | null = null, heroProjRight: number | null = null
  let heroWinLeft: number | null = null, heroWinRight: number | null = null

  if (isViewingOwn || !cachedFixtures[viewedFixtureId!]) {
    // Viewing own matchup (default), or cache for the selected matchup hasn't loaded yet
    heroLeftName = d.my_team?.name || ''
    heroRightName = d.opp_team?.name || ''
    heroLeftScore = d.my_score
    heroRightScore = d.opp_score
    heroLeftCapBonus = d.my_captain_bonus
    heroRightCapBonus = d.opp_captain_bonus
    heroLeftPlayers = d.my_players || []
    heroRightPlayers = d.opp_players || []
    heroLeftLogo = d.my_team?.logo_url
    heroRightLogo = d.opp_team?.logo_url
    heroLeftTeamId = d.my_team?.id
    heroRightTeamId = d.opp_team?.id
    // Only show own projection if the user is actually viewing their own matchup.
    // If the cache for a different matchup is still loading, show no projection
    // rather than wrongly displaying the user's own numbers.
    if (isViewingOwn && d.projections) {
      heroProjLeft = d.projections.my_projected
      heroProjRight = d.projections.opp_projected
      heroWinLeft = d.projections.my_win_pct
      heroWinRight = d.projections.opp_win_pct
    }
  } else {
    // Viewing another matchup
    const fx = cachedFixtures[viewedFixtureId!]
    const meta = d.round_fixtures.find(f => f.id === viewedFixtureId)
    heroLeftName = meta?.home_team?.name || ''
    heroRightName = meta?.away_team?.name || ''
    heroLeftScore = fx.home_score || 0
    heroRightScore = fx.away_score || 0
    heroLeftCapBonus = fx.home_captain_bonus || 0
    heroRightCapBonus = fx.away_captain_bonus || 0
    heroLeftPlayers = fx.home_players || []
    heroRightPlayers = fx.away_players || []
    heroLeftLogo = meta?.home_team?.logo_url
    heroRightLogo = meta?.away_team?.logo_url
    heroLeftTeamId = meta?.home_team_id
    heroRightTeamId = meta?.away_team_id
    // fx.projections has home_/away_ semantics
    if (fx.projections) {
      heroProjLeft = fx.projections.home_projected
      heroProjRight = fx.projections.away_projected
      heroWinLeft = fx.projections.home_win_pct
      heroWinRight = fx.projections.away_win_pct
    }
  }

  // Authoritative round_scores entries (matches Jinja's round_scores.get(team.id))
  if (heroLeftTeamId != null) heroLeftRs = d.round_scores?.[String(heroLeftTeamId)]
  if (heroRightTeamId != null) heroRightRs = d.round_scores?.[String(heroRightTeamId)]

  const diff = Math.abs(Math.round(heroLeftScore - heroRightScore))

  // Score flash: detect when scores change
  if (heroLeftScore !== prevScores.current.left || heroRightScore !== prevScores.current.right) {
    if (prevScores.current.left !== 0 || prevScores.current.right !== 0) {
      // Not first render — trigger flash + subtle haptic buzz on mobile
      setTimeout(() => { setScoreFlash(true); setTimeout(() => setScoreFlash(false), 1500) }, 0)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(12) } catch { /* ignore */ }
      }
    }
    prevScores.current = { left: heroLeftScore, right: heroRightScore }
  }

  function PlayerRow({ p }: { p: GDPlayer }) {
    const ytp = !p.game_started && gs === 'live'
    const isSubbedOn = p.subbed_on
    const isEmgStandby = p.is_emergency && !isSubbedOn
    const isLocked = !!(p.player_id && d.locked_player_ids?.includes(p.player_id))

    const rowClass = [
      'gd-prow',
      isLocked && 'locked',
      p.is_dnp && 'dnp',
      isSubbedOn && 'subbed-on',
      p.lineup_type === 'reserve' && 'reserve',
      isEmgStandby && 'emg-standby',
      ytp && 'ytp',
    ].filter(Boolean).join(' ')

    const scoreCls = [
      'gd-pscore',
      p.is_dnp && 'dnp',
      (p.lineup_type === 'reserve' || isEmgStandby) && 'muted',
      ytp && 'ytp',
      p.is_live && !ytp && !isEmgStandby && 'live',
    ].filter(Boolean).join(' ')

    const pos = (p.position || '').split('/')[0].toUpperCase()
    const posCls = `gd-pos ${pos.toLowerCase()}`

    return (
      <div className={rowClass}>
        <span className={posCls}>{pos || '—'}</span>
        <div className="gd-pbody">
          <div className="gd-prow-name">
            {p.is_captain && <span className="gd-pbadge c">C</span>}
            {p.is_vice_captain && <span className="gd-pbadge vc">VC</span>}
            {isSubbedOn && <span className="gd-pbadge emg-active">EMG</span>}
            {p.is_dnp && !isSubbedOn && <span className="gd-pbadge dnp">DNP</span>}
            {isEmgStandby && <span className="gd-pbadge emg">EMG</span>}
            <span className="gd-pname">{p.name}</span>
          </div>
          <div className="gd-pfix">
            {p.afl_team && d.team_logos[p.afl_team]
              ? <img src={d.team_logos[p.afl_team]} alt={p.afl_team} title={p.afl_team} />
              : <span>{p.afl_team}</span>}
            {d.afl_matchup_info[p.afl_team] && <span>{d.afl_matchup_info[p.afl_team]}</span>}
            {p.replaces && <span className="gd-sub-note">&rarr; for {p.replaces}</span>}
          </div>
        </div>
        <span className={scoreCls}>
          {p.lineup_type === 'reserve' || isEmgStandby
            ? '–'
            : ytp
              ? <><i className="bi bi-clock" style={{ fontSize: '.62rem' }}></i></>
              : (p.score || 0)}
        </span>
      </div>
    )
  }

  function PlayerCard({ players, teamName, score }: { players: GDPlayer[]; teamName: string; score: number }) {
    // Has a game this round?
    const hasGame = (p: GDPlayer) => teamsPlayingSet.size === 0 || teamsPlayingSet.has(p.afl_team)

    // Field section: field players (not DNP) PLUS subbed-on emergencies — both must have a game
    const fieldStarters = players.filter(p => p.lineup_type === 'field' && !p.is_dnp && hasGame(p))
    const subbedOnEmgs = players.filter(p => p.lineup_type === 'emergency' && p.subbed_on && hasGame(p))
    const field = [...fieldStarters, ...subbedOnEmgs]
    // Bench: lineup_type 'reserve' (backend uses 'reserve', original Jinja used 'bench' which was a Jinja bug)
    const bench = players.filter(p => p.lineup_type === 'reserve' && hasGame(p))
    // Emergency standby: emergency players that are NOT subbed on
    const emgStandby = players.filter(p => p.lineup_type === 'emergency' && !p.subbed_on && hasGame(p))
    // DNPs
    const dnps = players.filter(p => p.is_dnp && hasGame(p))
    // No game this round (any lineup type whose AFL team has no game)
    const noGame = players.filter(p => !hasGame(p))

    return (
      <div className="gd-pcard">
        <div className="gd-pcard-header">
          <span className="gd-pcard-name">{teamName}</span>
          {gs !== 'upcoming' && <span className="gd-pcard-total">{Math.round(score)}</span>}
        </div>
        <div>
          <div className="gd-section field"><i className="bi bi-broadcast"></i>Field · {field.length}</div>
          {field.map((p, i) => <PlayerRow key={i} p={p} />)}
          {bench.length > 0 && <>
            <div className="gd-section bench"><i className="bi bi-arrow-left-right"></i>Bench · {bench.length}</div>
            {bench.map((p, i) => <PlayerRow key={`b${i}`} p={p} />)}
          </>}
          {emgStandby.length > 0 && <>
            <div className="gd-section emergency"><i className="bi bi-shield-exclamation"></i>Emergency · {emgStandby.length}</div>
            {emgStandby.map((p, i) => <PlayerRow key={`e${i}`} p={p} />)}
          </>}
          {dnps.length > 0 && <>
            <div className="gd-section dnp"><i className="bi bi-x-circle"></i>Did Not Play · {dnps.length}</div>
            {dnps.map((p, i) => <PlayerRow key={`d${i}`} p={p} />)}
          </>}
          {noGame.length > 0 && <>
            <div className="gd-section nogame"><i className="bi bi-calendar-x"></i>No Game · {noGame.length}</div>
            {noGame.map((p, i) => <PlayerRow key={`ng${i}`} p={p} />)}
          </>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{GAMEDAY_CSS}</style>

      {/* Comp toggle */}
      <div className="gd-comp-toggle">
        <span className="gd-comp-btn active">Main</span>
        <Link to={`/leagues/${leagueId}/reserve7s/gameday`} className="gd-comp-btn">7s</Link>
      </div>

      {/* Round bar — title + TV clock + refresh */}
      <div className="gd-round-bar">
        <div>
          <div className="gd-round-title">{d.afl_round === 0 ? 'PRE-SEASON' : `ROUND ${d.afl_round}`}</div>
          {d.round_dates && <div className="gd-round-dates">{d.round_dates}</div>}
        </div>
        <div className="gd-round-state">
          {(() => {
            const c = deriveClock(d)
            return (
              <div className={`gd-clock ${c.tone}`}>
                <span className="gd-clock-label">{c.label}</span>
                <span className="gd-clock-sub">{c.sub}</span>
              </div>
            )
          })()}
          <button className="gd-refresh" onClick={handleRefresh} disabled={refreshing} title="Sync scores">
            {refreshing ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }}></span> : <i className="bi bi-arrow-clockwise"></i>}
          </button>
        </div>
      </div>

      {/* AFL broadcast ticker — live first, then upcoming, then complete */}
      {d.afl_games && d.afl_games.length > 0 && (() => {
        const order = (s: string) => s === 'live' ? 0 : s === 'complete' ? 2 : 1
        const sorted = [...d.afl_games].sort((a, b) => order(a.status) - order(b.status))
        return (
          <div className="gd-ticker d-none d-lg-flex">
            {sorted.map(g => {
              const tone = g.status === 'live' ? 'live' : g.status === 'complete' ? 'done' : 'upcoming'
              const homeAbbr = d.team_abbr[g.home_team] || g.home_team.substring(0, 3).toUpperCase()
              const awayAbbr = d.team_abbr[g.away_team] || g.away_team.substring(0, 3).toUpperCase()
              return (
                <Link key={g.game_id} to={`/leagues/${leagueId}/gameday/afl-game/${g.game_id}`} className={`gd-ticker-pill ${tone}`}>
                  <span className="gd-ticker-dot"></span>
                  <span className="gd-ticker-teams">{homeAbbr} v {awayAbbr}</span>
                  {g.home_score != null && <span className="gd-ticker-score">{g.home_score}-{g.away_score}</span>}
                  <span className="gd-ticker-tag">
                    {g.status === 'live' ? 'LIVE' : g.status === 'complete' ? 'FT' : (g.scheduled_display || (g.scheduled_start ? g.scheduled_start.substring(11, 16) : 'TBC'))}
                  </span>
                </Link>
              )
            })}
          </div>
        )
      })()}

      {/* KL fixtures mini bar */}
      {d.round_fixtures && d.round_fixtures.length > 0 && (
        <div className="gd-mini-bar">
          {d.round_fixtures.map(f => {
            const cached = cachedFixtures[f.id]
            const hs = cached?.home_score ?? d.round_scores[String(f.home_team_id)]?.total_score ?? 0
            const as_ = cached?.away_score ?? d.round_scores[String(f.away_team_id)]?.total_score ?? 0
            const isYours = !!(d.my_team && (f.home_team_id === d.my_team.id || f.away_team_id === d.my_team.id))
            const isActive = viewedFixtureId === f.id
            const cls = ['gd-mini-pill', isActive && 'active', isYours && !isActive && 'yours'].filter(Boolean).join(' ')
            return (
              <div key={f.id} className={cls} onClick={() => viewMatchup(f.id)}>
                <span className="gd-mini-teams">{f.home_team?.name} v {f.away_team?.name}</span>
                {f.status !== 'scheduled' && <span className="gd-mini-score">{Math.round(hs)}-{Math.round(as_)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* BYE */}
      {d.is_bye ? (
        <div className="gd-bye">
          <h4><i className="bi bi-dash-circle me-2"></i>Bye this round</h4>
          <p>Click any matchup above to view it.</p>
        </div>
      ) : (
        <>
          {/* Hero — neutral scoreboard. Team identity = LOGO + top
              accent band. Emphasis = leading score coloured in its
              team accent. */}
          {(() => {
            const leftAccent = accentFor(heroLeftTeamId)
            const rightAccent = accentFor(heroRightTeamId)
            const leftWinning = heroLeftScore > heroRightScore
            const rightWinning = heroRightScore > heroLeftScore
            const isPre = gs === 'upcoming'
            const leftCount = heroLeftRs?.players_total != null
              ? { played: heroLeftRs.players_played ?? 0, total: heroLeftRs.players_total }
              : countPlayed(heroLeftPlayers)
            const rightCount = heroRightRs?.players_total != null
              ? { played: heroRightRs.players_played ?? 0, total: heroRightRs.players_total }
              : countPlayed(heroRightPlayers)
            const leftStyle = {
              ['--gd-side-accent' as string]: `rgba(${leftAccent.rgb},.6)`,
              ['--gd-side-hex' as string]: leftAccent.hex,
              ['--gd-side-rgb' as string]: leftAccent.rgb,
            } as React.CSSProperties
            const rightStyle = {
              ['--gd-side-accent' as string]: `rgba(${rightAccent.rgb},.6)`,
              ['--gd-side-hex' as string]: rightAccent.hex,
              ['--gd-side-rgb' as string]: rightAccent.rgb,
            } as React.CSSProperties
            const bandStyle = {
              ['--gd-left-accent' as string]: leftAccent.hex,
              ['--gd-right-accent' as string]: rightAccent.hex,
            } as React.CSSProperties
            const leftScoreCls = `gd-hero-score${isPre ? ' pre' : leftWinning ? ' leading' : ''}${scoreFlash ? ' score-flash' : ''}`
            const rightScoreCls = `gd-hero-score${isPre ? ' pre' : rightWinning ? ' leading' : ''}${scoreFlash ? ' score-flash' : ''}`
            return (
              <div className="gd-hero">
                <div className="gd-hero-band" style={bandStyle}>
                  <span className="gd-hero-band-l"></span>
                  <span className="gd-hero-band-r"></span>
                </div>
                <div className="gd-hero-split">
                  <div className="gd-hero-side" style={leftStyle}>
                    {isViewingOwn && <span className="gd-hero-you">YOU</span>}
                    <div className="gd-hero-top">
                      <span className="gd-hero-crest">
                        {heroLeftLogo
                          ? <img src={heroLeftLogo} alt="" />
                          : heroLeftName.substring(0, 2).toUpperCase()}
                      </span>
                      <span className="gd-hero-name">{heroLeftName}</span>
                    </div>
                    <div className="gd-hero-score-wrap">
                      <AnimatedNumber value={heroLeftScore} className={leftScoreCls} />
                    </div>
                    <div className="gd-hero-meta">
                      {leftCount.total > 0 && <span className="gd-hero-played">{leftCount.played}/{leftCount.total} played</span>}
                      <CapBadges players={heroLeftPlayers} rs={heroLeftRs} />
                      {heroLeftCapBonus > 0 && <span className="gd-cap-bonus">+{Math.round(heroLeftCapBonus)} C</span>}
                    </div>
                  </div>

                  <div className="gd-hero-side right" style={rightStyle}>
                    <div className="gd-hero-top">
                      <span className="gd-hero-crest">
                        {heroRightLogo
                          ? <img src={heroRightLogo} alt="" />
                          : heroRightName.substring(0, 2).toUpperCase()}
                      </span>
                      <span className="gd-hero-name">{heroRightName}</span>
                    </div>
                    <div className="gd-hero-score-wrap">
                      <AnimatedNumber value={heroRightScore} className={rightScoreCls} />
                    </div>
                    <div className="gd-hero-meta">
                      {heroRightCapBonus > 0 && <span className="gd-cap-bonus">+{Math.round(heroRightCapBonus)} C</span>}
                      <CapBadges players={heroRightPlayers} rs={heroRightRs} />
                      {rightCount.total > 0 && <span className="gd-hero-played">{rightCount.played}/{rightCount.total} played</span>}
                    </div>
                  </div>
                </div>

                {/* State-aware bottom strip — no margin chip pre-match */}
                <div className="gd-hero-strip">
                  {gs === 'upcoming' ? (
                    <>
                      {d.first_bounce && (
                        <span className="gd-first-bounce">
                          <i className="bi bi-clock-fill"></i>First bounce {d.first_bounce}
                        </span>
                      )}
                      {heroProjLeft != null && heroProjRight != null && (
                        <div className="gd-proj-row">
                          <span className="gd-proj-item">Proj <b>{Math.round(heroProjLeft)}</b>&ndash;<b>{Math.round(heroProjRight)}</b></span>
                          <span className="gd-proj-sep"></span>
                          <span className="gd-proj-item">Win <b>{Math.round(heroWinLeft || 0)}%</b>&ndash;<b>{Math.round(heroWinRight || 0)}%</b></span>
                        </div>
                      )}
                    </>
                  ) : gs === 'completed' ? (
                    <>
                      {(leftWinning || rightWinning) && (
                        <div className={`gd-margin-chip${
                          isViewingOwn && leftWinning ? ' win'
                          : isViewingOwn && rightWinning ? ' loss'
                          : ''
                        }`}>
                          {isViewingOwn ? (
                            leftWinning ? <><i className="bi bi-trophy-fill"></i>WON BY {diff}</> :
                            <>LOST BY {diff}</>
                          ) : (
                            leftWinning ? <>{heroLeftName} BY {diff}</> :
                            <>{heroRightName} BY {diff}</>
                          )}
                        </div>
                      )}
                      {!leftWinning && !rightWinning && (
                        <div className="gd-margin-chip">DRAW</div>
                      )}
                      {d.fixture && (
                        <Link to={`/leagues/${leagueId}/matchup/${d.fixture.id}`} className="gd-breakdown-link">
                          <i className="bi bi-bar-chart-line"></i>Full Breakdown
                        </Link>
                      )}
                    </>
                  ) : (
                    /* Live — only show margin chip once one side is actually ahead */
                    <>
                      {(leftWinning || rightWinning) && (
                        <div className={`gd-margin-chip${
                          isViewingOwn && leftWinning ? ' up'
                          : isViewingOwn && rightWinning ? ' down'
                          : ''
                        }`}>
                          {isViewingOwn ? (
                            leftWinning ? <><i className="bi bi-caret-up-fill"></i>UP {diff}</> :
                            <><i className="bi bi-caret-down-fill"></i>DOWN {diff}</>
                          ) : (
                            leftWinning ? <>{heroLeftName} BY {diff}</> :
                            <>{heroRightName} BY {diff}</>
                          )}
                        </div>
                      )}
                      {heroProjLeft != null && heroProjRight != null && (
                        <div className="gd-proj-row">
                          <span className="gd-proj-item">Proj <b>{Math.round(heroProjLeft)}</b>&ndash;<b>{Math.round(heroProjRight)}</b></span>
                          <span className="gd-proj-sep"></span>
                          <span className="gd-proj-item">Win <b>{Math.round(heroWinLeft || 0)}%</b>&ndash;<b>{Math.round(heroWinRight || 0)}%</b></span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Mobile side-by-side view */}
          <div className="d-lg-none mt-3 gd-mob-vs">
            <div className="gd-mob-vs-header">
              <span className="gd-mob-vs-team">{heroLeftName}</span>
              <span className="gd-mob-vs-scores">
                <span className={`gd-mob-vs-sc${heroLeftScore > heroRightScore ? ' gd-mob-sc-win' : ''}`}>{Math.round(heroLeftScore)}</span>
                <span style={{ color: '#484f58', fontSize: '.7rem' }}>v</span>
                <span className={`gd-mob-vs-sc${heroRightScore > heroLeftScore ? ' gd-mob-sc-win' : ''}`}>{Math.round(heroRightScore)}</span>
              </span>
              <span className="gd-mob-vs-team" style={{ textAlign: 'right' }}>{heroRightName}</span>
            </div>
            <div className="gd-mob-section-hdr"><i className="bi bi-people-fill me-1"></i>Field</div>
            {(() => {
              // Field = field starters (not DNP) + subbed-on emergencies (matches Jinja lines 247-253)
              const buildField = (players: GDPlayer[]) => [
                ...players.filter(p => p.lineup_type === 'field' && !p.is_dnp),
                ...players.filter(p => p.lineup_type === 'emergency' && p.subbed_on),
              ]
              const lp = buildField(heroLeftPlayers)
              const rp = buildField(heroRightPlayers)
              const maxLen = Math.max(lp.length, rp.length)
              return Array.from({ length: maxLen }).map((_, i) => {
                const mp = lp[i]
                const op = rp[i]
                return (
                  <div key={i} className="gd-mob-vs-row">
                    <div className="gd-mob-vs-left">
                      {mp && <>
                        <span className="gd-mob-vs-name">
                          {mp.is_captain && <b className="gd-mob-c">C</b>}
                          {mp.is_vice_captain && <b className="gd-mob-vc">VC</b>}
                          {mp.subbed_on && <span className="gameday-badge-emg-active" style={{ fontSize: '.5rem', padding: '0 3px' }}>EMG</span>}
                          {mp.name}
                        </span>
                        <span className={`gd-mob-vs-pos pos-badge pos-${(mp.position || 'MID').split('/')[0].toUpperCase()}`}>{(mp.position || 'MID').split('/')[0].substring(0, 3).toUpperCase()}</span>
                      </>}
                    </div>
                    <div className="gd-mob-vs-mid">
                      <span className={`gd-mob-sc-l${mp?.is_live ? ' text-success' : ''}`}>
                        {mp ? (mp.score || 0) : '-'}
                        {mp?.is_live && <i className="bi bi-circle-fill gameday-live-dot"></i>}
                      </span>
                      <span className={`gd-mob-sc-r${op?.is_live ? ' text-success' : ''}`}>
                        {op ? (op.score || 0) : '-'}
                        {op?.is_live && <i className="bi bi-circle-fill gameday-live-dot"></i>}
                      </span>
                    </div>
                    <div className="gd-mob-vs-right">
                      {op && <>
                        <span className={`gd-mob-vs-pos pos-badge pos-${(op.position || 'MID').split('/')[0].toUpperCase()}`}>{(op.position || 'MID').split('/')[0].substring(0, 3).toUpperCase()}</span>
                        <span className="gd-mob-vs-name">
                          {op.is_captain && <b className="gd-mob-c">C</b>}
                          {op.is_vice_captain && <b className="gd-mob-vc">VC</b>}
                          {op.subbed_on && <span className="gameday-badge-emg-active" style={{ fontSize: '.5rem', padding: '0 3px' }}>EMG</span>}
                          {op.name}
                        </span>
                      </>}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Player cards - desktop */}
          <div className="row g-3 mt-2 d-none d-lg-flex">
            <div className="col-md-6">
              <PlayerCard players={heroLeftPlayers} teamName={heroLeftName} score={heroLeftScore} />
            </div>
            <div className="col-md-6">
              <PlayerCard players={heroRightPlayers} teamName={heroRightName} score={heroRightScore} />
            </div>
          </div>

          {/* Mobile: side-by-side view above already shows all players —
               individual team cards only needed on desktop */}
        </>
      )}

      {/* Footer */}
      <div className="gd-foot">
        <span>
          {gs === 'live' ? <><i className="bi bi-broadcast me-1" style={{ color: '#7dc99a' }}></i>Live · WebSocket sync</>
            : gs === 'completed' ? 'Final results'
            : <>&nbsp;</>}
        </span>
        <Link to={`/leagues/${leagueId}/fixture`}>Season Fixture &rarr;</Link>
      </div>

      {/* All matchups grid — hidden (matching original template display:none) */}
      <div className="gameday-all-matchups mt-4" style={{ display: 'none' }}>
        <div className="gameday-matchups-header">
          <span><i className="bi bi-grid-3x2-gap me-2"></i>ROUND {d.afl_round} MATCHUPS</span>
          {d.round_dates && <span className="matchups-header-dates">{d.round_dates}</span>}
        </div>
        <div className="gameday-matchups-grid">
          {(d.round_fixtures || []).map(f => {
            const hs = d.round_scores[String(f.home_team_id)]?.total_score || f.home_score || 0
            const as_ = d.round_scores[String(f.away_team_id)]?.total_score || f.away_score || 0
            const isYours = d.my_team && (f.home_team_id === d.my_team.id || f.away_team_id === d.my_team.id)
            const homeWon = hs > as_ && f.status !== 'scheduled'
            const awayWon = as_ > hs && f.status !== 'scheduled'
            const total = hs + as_ || 1
            return (
              <div key={f.id} className={`gameday-matchup-card${isYours ? ' matchup-yours' : ''}${viewedFixtureId === f.id ? ' matchup-active' : ''}${isYours && viewedFixtureId !== f.id ? ' matchup-yours-dimmed' : ''}`}
                onClick={() => viewMatchup(f.id)} style={{ cursor: 'pointer' }}>
                {isYours && <span className="matchup-your-tag">Your Match</span>}
                <div className="matchup-team-row">
                  <span className={`matchup-team-name${homeWon ? ' matchup-winner' : ''}`}>{f.home_team?.name}</span>
                  <span className="matchup-team-score">
                    {f.status !== 'scheduled' && Math.round(hs)}
                    {homeWon && <i className="bi bi-check-lg" style={{ color: 'var(--kl-accent-green)', fontSize: '.7rem' }}></i>}
                  </span>
                </div>
                <div className="matchup-team-row">
                  <span className={`matchup-team-name${awayWon ? ' matchup-winner' : ''}`}>{f.away_team?.name}</span>
                  <span className="matchup-team-score">
                    {f.status !== 'scheduled' && Math.round(as_)}
                    {awayWon && <i className="bi bi-check-lg" style={{ color: 'var(--kl-accent-green)', fontSize: '.7rem' }}></i>}
                  </span>
                </div>
                {f.status !== 'scheduled' && (
                  <div className="matchup-mini-bar">
                    <div className="matchup-mini-fill" style={{ width: `${(hs / total) * 100}%` }}></div>
                  </div>
                )}
                {/* Player counts + C/VC badges from cached data */}
                {cachedFixtures[f.id] && (
                  <div className="d-flex justify-content-between align-items-center" style={{ marginTop: 6 }}>
                    {(() => { const hc = countPlayed(cachedFixtures[f.id].home_players || []); return hc.total > 0 ? <span className="matchup-players-count" style={{ fontSize: '.6rem', color: 'var(--kl-text-faint)' }}>{hc.played}/{hc.total}</span> : <span></span> })()}
                    <div className="d-flex gap-1">
                      <CapBadges players={cachedFixtures[f.id].home_players || []} />
                      <CapBadges players={cachedFixtures[f.id].away_players || []} />
                    </div>
                    {(() => { const ac = countPlayed(cachedFixtures[f.id].away_players || []); return ac.total > 0 ? <span className="matchup-players-count" style={{ fontSize: '.6rem', color: 'var(--kl-text-faint)' }}>{ac.played}/{ac.total}</span> : <span></span> })()}
                  </div>
                )}
                {f.status !== 'scheduled' && (hs !== as_) && (
                  <div className="matchup-margin">{homeWon ? f.home_team?.name : f.away_team?.name} +{Math.round(Math.abs(hs - as_))}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
