import{b as e,f as t,h as n,i as r,n as i,p as a,t as o}from"./Spinner-BZqcd_eb.js";import{n as s}from"./api-BFFY-yxh.js";import{t as c}from"./AnimatedNumber-BUBHAl_p.js";import{t as l}from"./esm-CjhOkhEX.js";var u=e(n(),1),d=i(),f=[{hex:`#3a7dc4`,rgb:`58,125,196`},{hex:`#b87f3d`,rgb:`184,127,61`},{hex:`#8a6db8`,rgb:`138,109,184`},{hex:`#3d8c63`,rgb:`61,140,99`},{hex:`#c2932f`,rgb:`194,147,47`},{hex:`#b85a4a`,rgb:`184,90,74`},{hex:`#3d8a9c`,rgb:`61,138,156`},{hex:`#9d5878`,rgb:`157,88,120`}];function p(e){return f[((e??0)%f.length+f.length)%f.length]}function ee(e){let t=e.afl_games||[],n=t.filter(e=>e.status===`live`).length,r=t.filter(e=>e.status===`complete`).length,i=t.length;return e.gameday_state===`completed`?{tone:`done`,label:`FULL TIME`,sub:i?`${i}/${i} games`:`Round complete`}:e.gameday_state===`live`?{tone:`live`,label:n>0?`LIVE · ${n} ON`:`BETWEEN GAMES`,sub:`${r}/${i} games done`}:{tone:`upcoming`,label:`PRE-MATCH`,sub:e.first_bounce?`Bounce ${e.first_bounce}`:`Awaiting first bounce`}}var te=`
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

/* Hero card */
.gd-hero { position: relative; border-radius: 18px; padding: 22px 24px 18px; margin-bottom: 14px; background: radial-gradient(ellipse at 50% 0%, rgba(20,28,46,.92) 0%, rgba(11,16,28,.96) 65%, rgba(8,12,22,.98) 100%); border: 1px solid rgba(110,130,180,.2); overflow: hidden; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.gd-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, rgba(var(--gd-left-rgb, 97,140,196), .55), transparent 35%, transparent 65%, rgba(var(--gd-right-rgb, 184,90,74), .55)); }
.gd-hero.live::after { content: ''; position: absolute; inset: 0; border-radius: 18px; pointer-events: none; box-shadow: 0 0 36px -4px rgba(61,140,99,.22) inset; animation: gdHeroGlow 5s ease-in-out infinite; }
@keyframes gdHeroGlow { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }

.gd-hero-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-bottom: 16px; }
.gd-hero-team { display: flex; align-items: center; gap: 14px; min-width: 0; }
.gd-hero-team.right { flex-direction: row-reverse; }

.gd-crest { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 14px; font-weight: 900; font-size: 1.05rem; letter-spacing: .04em; color: #fff; flex-shrink: 0; box-shadow: 0 8px 22px -4px rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.08); }
.gd-crest-img { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; flex-shrink: 0; box-shadow: 0 8px 22px -4px rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.1); background: rgba(15,22,36,.4); }

.gd-team-detail { min-width: 0; flex: 1; }
.gd-hero-team.right .gd-team-detail { text-align: right; }
.gd-team-name { font-size: .94rem; font-weight: 800; color: #f5f8ff; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.gd-team-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.gd-hero-team.right .gd-team-meta { justify-content: flex-end; }
.gd-played { font-size: .64rem; color: #6c7892; font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: .04em; }
.gd-role-badge { font-size: .54rem; font-weight: 800; letter-spacing: .08em; padding: 2px 6px; border-radius: 4px; color: #6c7892; background: rgba(110,130,180,.08); border: 1px solid rgba(110,130,180,.15); }
.gd-role-badge.active { color: #f0d27a; background: rgba(194,147,47,.16); border-color: rgba(194,147,47,.36); }
.gd-role-badge.active.vc { color: #82b3e4; background: rgba(58,125,196,.16); border-color: rgba(58,125,196,.36); }

.gd-vs { font-size: .56rem; font-weight: 800; letter-spacing: .22em; color: #4a5471; padding: 0 4px; }

.gd-hero-scores { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; }
.gd-hero-score-col { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.gd-hero-score { font-size: 3.6rem; font-weight: 900; line-height: 1; color: #97a3ba; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; letter-spacing: -.04em; transition: color .35s, text-shadow .35s; }
.gd-hero-score.winning { color: var(--gd-side-accent, #f0f4fc); text-shadow: 0 0 28px rgba(var(--gd-side-rgb, 122,155,196), .4); }
.gd-hero-dash { font-size: 2.2rem; font-weight: 200; color: #38415a; padding-top: 8px; line-height: 1; }
.gd-cap-bonus { font-size: .65rem; font-weight: 700; color: #f0d27a; letter-spacing: .08em; white-space: nowrap; }

.gd-hero-footer { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(110,130,180,.1); }
.gd-margin-chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 18px; border-radius: 10px; font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #dde4f1; background: rgba(255,255,255,.04); border: 1px solid rgba(110,130,180,.18); font-variant-numeric: tabular-nums; }
.gd-margin-chip.win { color: #7dc99a; background: rgba(61,140,99,.1); border-color: rgba(61,140,99,.3); }
.gd-margin-chip.loss { color: #e07a6c; background: rgba(184,90,74,.1); border-color: rgba(184,90,74,.3); }
.gd-margin-chip.up { color: #7dc99a; }
.gd-margin-chip.down { color: #e07a6c; }

.gd-proj-row { display: flex; align-items: center; gap: 14px; font-size: .66rem; color: #6c7892; font-variant-numeric: tabular-nums; }
.gd-proj-item b { font-weight: 700; color: #b6c0d3; }
.gd-proj-sep { width: 3px; height: 3px; border-radius: 50%; background: rgba(110,130,180,.3); }

.gd-first-bounce { text-align: center; font-size: .82rem; color: #b6c0d3; margin-top: 4px; }
.gd-breakdown-link { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; font-size: .72rem; font-weight: 700; color: #82b3e4; text-decoration: none; background: rgba(58,125,196,.1); border: 1px solid rgba(58,125,196,.25); transition: background .14s; margin-top: 4px; }
.gd-breakdown-link:hover { background: rgba(58,125,196,.18); color: #a8c8ed; text-decoration: none; }

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
`;function m(){let{leagueId:e}=t(),[n]=a(),i=n.get(`fixture`),f=n.get(`round`),[m,ne]=(0,u.useState)(null),[re,ie]=(0,u.useState)(!0),[h,g]=(0,u.useState)(i?Number(i):null),[_,v]=(0,u.useState)({}),[y,b]=(0,u.useState)(!1),[x,S]=(0,u.useState)(!1),C=(0,u.useRef)({left:0,right:0}),w=(0,u.useCallback)(()=>{s(`/leagues/${e}/gameday?format=json${f?`&round=${f}`:``}`).then(e=>{ne(e),!h&&e.fixture&&g(e.fixture.id)}).catch(()=>{}).finally(()=>ie(!1))},[e,f]),ae=(0,u.useCallback)(()=>{m&&s(`/leagues/${e}/gameday/api/fixtures?round=${m.afl_round}`).then(e=>{let t={};e.fixtures?.forEach(e=>{t[e.fixture_id]=e}),v(t)}).catch(()=>{})},[e,m?.afl_round]);(0,u.useEffect)(()=>{w();let e=setInterval(w,6e4);return()=>clearInterval(e)},[w]),(0,u.useEffect)(()=>{i&&g(Number(i))},[i]),(0,u.useEffect)(()=>{m?.gameday_state},[m?.gameday_state]);let oe=(0,u.useRef)(null),se=(0,u.useRef)(0),ce=m?.gameday_state===`live`&&!!m?.live_enabled,T=m?.afl_round;(0,u.useEffect)(()=>{if(!ce)return;let t=l(`/matchups`,{withCredentials:!0,reconnection:!0,reconnectionAttempts:1/0,reconnectionDelay:2e3,reconnectionDelayMax:3e4});return oe.current=t,t.on(`connect`,()=>{t.emit(`join_live`,{league_id:Number(e),afl_round:T}),t.emit(`request_scores`,{league_id:Number(e),afl_round:T})}),t.on(`score_update`,e=>{e.seq&&e.seq<=se.current||(e.seq&&(se.current=e.seq),e.fixtures&&v(t=>{let n={...t};return e.fixtures.forEach(e=>{n[e.fixture_id]=e}),n}))}),()=>{t.disconnect(),oe.current=null}},[e,ce,T]);let E=(0,u.useRef)(!1);(0,u.useEffect)(()=>{m&&!E.current&&(E.current=!0,ae())},[m,ae]);let D=(0,u.useCallback)(e=>{g(e)},[]),le=(0,u.useCallback)(async()=>{b(!0);try{await s(`/leagues/${e}/gameday/sync-scores`,{method:`POST`}).catch(()=>{}),w()}finally{setTimeout(()=>b(!1),1e3)}},[e,w]);if((0,u.useEffect)(()=>{if(m?.gameday_state!==`upcoming`)return;let t=setInterval(()=>{s(`/leagues/${e}/gameday/api/fixtures?round=${m.afl_round}`).then(e=>{}).catch(()=>{})},3e5);return()=>clearInterval(t)},[m?.gameday_state,m?.afl_round,e]),re)return(0,d.jsx)(o,{text:`Loading gameday...`});if(!m)return(0,d.jsx)(`p`,{className:`text-danger`,children:`Failed to load gameday`});let O=new Set(m.teams_playing||[]);function k(e){let t=new Set([`field`,`reserve`]),n=e.filter(e=>t.has(e.lineup_type)&&(O.size===0||O.has(e.afl_team)));return{played:n.filter(e=>e.game_started&&((e.score||0)>0||e.is_dnp)).length,total:n.length}}function ue(e){let t=!1,n=!1,r=!1,i=!1;return e.forEach(e=>{let a=e.game_started&&((e.score||0)>0||e.is_dnp);e.is_captain&&(t=!0,n=a),e.is_vice_captain&&(r=!0,i=a)}),{hasCap:t,capPlayed:n,hasVc:r,vcPlayed:i}}function A({players:e,rs:t}){let n=t&&t.has_captain!==void 0?{hasCap:!!t.has_captain,capPlayed:!!t.captain_played,hasVc:!!t.has_vc,vcPlayed:!!t.vc_played}:ue(e);return(0,d.jsxs)(`span`,{style:{display:`inline-flex`,gap:4},children:[n.hasCap&&(0,d.jsx)(`span`,{className:`gd-role-badge${n.capPlayed?` active`:``}`,children:`C`}),n.hasVc&&(0,d.jsx)(`span`,{className:`gd-role-badge vc${n.vcPlayed?` active`:``}`,children:`VC`})]})}let j=m,M=j.gameday_state,N=!h||h===j.fixture?.id,P,F,I,L,R,z,B,V,H,U,W,G,K,q,J=null,Y=null,X=null,Z=null;if(N||!_[h])P=j.my_team?.name||``,F=j.opp_team?.name||``,I=j.my_score,L=j.opp_score,R=j.my_captain_bonus,z=j.opp_captain_bonus,B=j.my_players||[],V=j.opp_players||[],H=j.my_team?.logo_url,U=j.opp_team?.logo_url,K=j.my_team?.id,q=j.opp_team?.id,N&&j.projections&&(J=j.projections.my_projected,Y=j.projections.opp_projected,X=j.projections.my_win_pct,Z=j.projections.opp_win_pct);else{let e=_[h],t=j.round_fixtures.find(e=>e.id===h);P=t?.home_team?.name||``,F=t?.away_team?.name||``,I=e.home_score||0,L=e.away_score||0,R=e.home_captain_bonus||0,z=e.away_captain_bonus||0,B=e.home_players||[],V=e.away_players||[],H=t?.home_team?.logo_url||null,U=t?.away_team?.logo_url||null,K=t?.home_team_id,q=t?.away_team_id,e.projections&&(J=e.projections.home_projected,Y=e.projections.away_projected,X=e.projections.home_win_pct,Z=e.projections.away_win_pct)}K!=null&&(W=j.round_scores?.[String(K)]),q!=null&&(G=j.round_scores?.[String(q)]);let Q=Math.abs(Math.round(I-L));if(I!==C.current.left||L!==C.current.right){if((C.current.left!==0||C.current.right!==0)&&(setTimeout(()=>{S(!0),setTimeout(()=>S(!1),1500)},0),typeof navigator<`u`&&navigator.vibrate))try{navigator.vibrate(12)}catch{}C.current={left:I,right:L}}function $({p:e}){let t=!e.game_started&&M===`live`,n=e.subbed_on,r=e.is_emergency&&!n,i=[`gd-prow`,!!(e.player_id&&j.locked_player_ids?.includes(e.player_id))&&`locked`,e.is_dnp&&`dnp`,n&&`subbed-on`,e.lineup_type===`reserve`&&`reserve`,r&&`emg-standby`,t&&`ytp`].filter(Boolean).join(` `),a=[`gd-pscore`,e.is_dnp&&`dnp`,(e.lineup_type===`reserve`||r)&&`muted`,t&&`ytp`,e.is_live&&!t&&!r&&`live`].filter(Boolean).join(` `),o=(e.position||``).split(`/`)[0].toUpperCase();return(0,d.jsxs)(`div`,{className:i,children:[(0,d.jsx)(`span`,{className:`gd-pos ${o.toLowerCase()}`,children:o||`—`}),(0,d.jsxs)(`div`,{className:`gd-pbody`,children:[(0,d.jsxs)(`div`,{className:`gd-prow-name`,children:[e.is_captain&&(0,d.jsx)(`span`,{className:`gd-pbadge c`,children:`C`}),e.is_vice_captain&&(0,d.jsx)(`span`,{className:`gd-pbadge vc`,children:`VC`}),n&&(0,d.jsx)(`span`,{className:`gd-pbadge emg-active`,children:`EMG`}),e.is_dnp&&!n&&(0,d.jsx)(`span`,{className:`gd-pbadge dnp`,children:`DNP`}),r&&(0,d.jsx)(`span`,{className:`gd-pbadge emg`,children:`EMG`}),(0,d.jsx)(`span`,{className:`gd-pname`,children:e.name})]}),(0,d.jsxs)(`div`,{className:`gd-pfix`,children:[e.afl_team&&j.team_logos[e.afl_team]?(0,d.jsx)(`img`,{src:j.team_logos[e.afl_team],alt:e.afl_team,title:e.afl_team}):(0,d.jsx)(`span`,{children:e.afl_team}),j.afl_matchup_info[e.afl_team]&&(0,d.jsx)(`span`,{children:j.afl_matchup_info[e.afl_team]}),e.replaces&&(0,d.jsxs)(`span`,{className:`gd-sub-note`,children:[`→ for `,e.replaces]})]})]}),(0,d.jsx)(`span`,{className:a,children:e.lineup_type===`reserve`||r?`–`:t?(0,d.jsx)(d.Fragment,{children:(0,d.jsx)(`i`,{className:`bi bi-clock`,style:{fontSize:`.62rem`}})}):e.score||0})]})}function de({players:e,teamName:t,score:n}){let r=e=>O.size===0||O.has(e.afl_team),i=e.filter(e=>e.lineup_type===`field`&&!e.is_dnp&&r(e)),a=e.filter(e=>e.lineup_type===`emergency`&&e.subbed_on&&r(e)),o=[...i,...a],s=e.filter(e=>e.lineup_type===`reserve`&&r(e)),c=e.filter(e=>e.lineup_type===`emergency`&&!e.subbed_on&&r(e)),l=e.filter(e=>e.is_dnp&&r(e)),u=e.filter(e=>!r(e));return(0,d.jsxs)(`div`,{className:`gd-pcard`,children:[(0,d.jsxs)(`div`,{className:`gd-pcard-header`,children:[(0,d.jsx)(`span`,{className:`gd-pcard-name`,children:t}),M!==`upcoming`&&(0,d.jsx)(`span`,{className:`gd-pcard-total`,children:Math.round(n)})]}),(0,d.jsxs)(`div`,{children:[(0,d.jsxs)(`div`,{className:`gd-section field`,children:[(0,d.jsx)(`i`,{className:`bi bi-broadcast`}),`Field · `,o.length]}),o.map((e,t)=>(0,d.jsx)($,{p:e},t)),s.length>0&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`div`,{className:`gd-section bench`,children:[(0,d.jsx)(`i`,{className:`bi bi-arrow-left-right`}),`Bench · `,s.length]}),s.map((e,t)=>(0,d.jsx)($,{p:e},`b${t}`))]}),c.length>0&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`div`,{className:`gd-section emergency`,children:[(0,d.jsx)(`i`,{className:`bi bi-shield-exclamation`}),`Emergency · `,c.length]}),c.map((e,t)=>(0,d.jsx)($,{p:e},`e${t}`))]}),l.length>0&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`div`,{className:`gd-section dnp`,children:[(0,d.jsx)(`i`,{className:`bi bi-x-circle`}),`Did Not Play · `,l.length]}),l.map((e,t)=>(0,d.jsx)($,{p:e},`d${t}`))]}),u.length>0&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`div`,{className:`gd-section nogame`,children:[(0,d.jsx)(`i`,{className:`bi bi-calendar-x`}),`No Game · `,u.length]}),u.map((e,t)=>(0,d.jsx)($,{p:e},`ng${t}`))]})]})]})}return(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`style`,{children:te}),(0,d.jsxs)(`div`,{className:`gd-comp-toggle`,children:[(0,d.jsx)(`span`,{className:`gd-comp-btn active`,children:`Main`}),(0,d.jsx)(r,{to:`/leagues/${e}/reserve7s/gameday`,className:`gd-comp-btn`,children:`7s`})]}),(0,d.jsxs)(`div`,{className:`gd-round-bar`,children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`div`,{className:`gd-round-title`,children:j.afl_round===0?`PRE-SEASON`:`ROUND ${j.afl_round}`}),j.round_dates&&(0,d.jsx)(`div`,{className:`gd-round-dates`,children:j.round_dates})]}),(0,d.jsxs)(`div`,{className:`gd-round-state`,children:[(()=>{let e=ee(j);return(0,d.jsxs)(`div`,{className:`gd-clock ${e.tone}`,children:[(0,d.jsx)(`span`,{className:`gd-clock-label`,children:e.label}),(0,d.jsx)(`span`,{className:`gd-clock-sub`,children:e.sub})]})})(),(0,d.jsx)(`button`,{className:`gd-refresh`,onClick:le,disabled:y,title:`Sync scores`,children:y?(0,d.jsx)(`span`,{className:`spinner-border spinner-border-sm`,style:{width:12,height:12}}):(0,d.jsx)(`i`,{className:`bi bi-arrow-clockwise`})})]})]}),j.afl_games&&j.afl_games.length>0&&(()=>{let t=e=>e===`live`?0:e===`complete`?2:1;return(0,d.jsx)(`div`,{className:`gd-ticker d-none d-lg-flex`,children:[...j.afl_games].sort((e,n)=>t(e.status)-t(n.status)).map(t=>{let n=t.status===`live`?`live`:t.status===`complete`?`done`:`upcoming`,i=j.team_abbr[t.home_team]||t.home_team.substring(0,3).toUpperCase(),a=j.team_abbr[t.away_team]||t.away_team.substring(0,3).toUpperCase();return(0,d.jsxs)(r,{to:`/leagues/${e}/gameday/afl-game/${t.game_id}`,className:`gd-ticker-pill ${n}`,children:[(0,d.jsx)(`span`,{className:`gd-ticker-dot`}),(0,d.jsxs)(`span`,{className:`gd-ticker-teams`,children:[i,` v `,a]}),t.home_score!=null&&(0,d.jsxs)(`span`,{className:`gd-ticker-score`,children:[t.home_score,`-`,t.away_score]}),(0,d.jsx)(`span`,{className:`gd-ticker-tag`,children:t.status===`live`?`LIVE`:t.status===`complete`?`FT`:t.scheduled_display||(t.scheduled_start?t.scheduled_start.substring(11,16):`TBC`)})]},t.game_id)})})})(),j.round_fixtures&&j.round_fixtures.length>0&&(0,d.jsx)(`div`,{className:`gd-mini-bar`,children:j.round_fixtures.map(e=>{let t=_[e.id],n=t?.home_score??j.round_scores[String(e.home_team_id)]?.total_score??0,r=t?.away_score??j.round_scores[String(e.away_team_id)]?.total_score??0,i=!!(j.my_team&&(e.home_team_id===j.my_team.id||e.away_team_id===j.my_team.id)),a=h===e.id;return(0,d.jsxs)(`div`,{className:[`gd-mini-pill`,a&&`active`,i&&!a&&`yours`].filter(Boolean).join(` `),onClick:()=>D(e.id),children:[(0,d.jsxs)(`span`,{className:`gd-mini-teams`,children:[e.home_team?.name,` v `,e.away_team?.name]}),e.status!==`scheduled`&&(0,d.jsxs)(`span`,{className:`gd-mini-score`,children:[Math.round(n),`-`,Math.round(r)]})]},e.id)})}),j.is_bye?(0,d.jsxs)(`div`,{className:`gd-bye`,children:[(0,d.jsxs)(`h4`,{children:[(0,d.jsx)(`i`,{className:`bi bi-dash-circle me-2`}),`Bye this round`]}),(0,d.jsx)(`p`,{children:`Click any matchup above to view it.`})]}):(0,d.jsxs)(d.Fragment,{children:[(()=>{let t=p(K),n=p(q),i=I>L,a=L>I,o=i?t:n,s={"--gd-left-rgb":t.rgb,"--gd-right-rgb":n.rgb},l=`linear-gradient(145deg, rgba(${t.rgb},.55), rgba(${t.rgb},.95))`,u=`linear-gradient(145deg, rgba(${n.rgb},.55), rgba(${n.rgb},.95))`;return(0,d.jsxs)(`div`,{className:`gd-hero ${M}`,style:s,children:[(0,d.jsxs)(`div`,{className:`gd-hero-teams`,children:[(0,d.jsxs)(`div`,{className:`gd-hero-team`,children:[H?(0,d.jsx)(`img`,{src:H,alt:``,className:`gd-crest-img`}):(0,d.jsx)(`span`,{className:`gd-crest`,style:{background:l},children:P.substring(0,2).toUpperCase()}),(0,d.jsxs)(`div`,{className:`gd-team-detail`,children:[(0,d.jsx)(`div`,{className:`gd-team-name`,children:P}),(0,d.jsxs)(`div`,{className:`gd-team-meta`,children:[(()=>{let e=W,t=e?.players_total??k(B).total,n=e?.players_played??k(B).played;return t>0?(0,d.jsxs)(`span`,{className:`gd-played`,children:[n,`/`,t,` played`]}):null})(),(0,d.jsx)(A,{players:B,rs:W})]})]})]}),(0,d.jsx)(`span`,{className:`gd-vs`,children:`VS`}),(0,d.jsxs)(`div`,{className:`gd-hero-team right`,children:[U?(0,d.jsx)(`img`,{src:U,alt:``,className:`gd-crest-img`}):(0,d.jsx)(`span`,{className:`gd-crest`,style:{background:u},children:F.substring(0,2).toUpperCase()}),(0,d.jsxs)(`div`,{className:`gd-team-detail`,children:[(0,d.jsx)(`div`,{className:`gd-team-name`,children:F}),(0,d.jsxs)(`div`,{className:`gd-team-meta`,children:[(0,d.jsx)(A,{players:V,rs:G}),(()=>{let e=G,t=e?.players_total??k(V).total,n=e?.players_played??k(V).played;return t>0?(0,d.jsxs)(`span`,{className:`gd-played`,children:[n,`/`,t,` played`]}):null})()]})]})]})]}),(0,d.jsxs)(`div`,{className:`gd-hero-scores`,children:[(0,d.jsxs)(`div`,{className:`gd-hero-score-col`,children:[(0,d.jsx)(c,{value:I,className:`gd-hero-score${i?` winning`:``}${x?` score-flash`:``}`,style:i?{"--gd-side-accent":t.hex,"--gd-side-rgb":t.rgb}:void 0}),R>0&&(0,d.jsxs)(`span`,{className:`gd-cap-bonus`,children:[`+`,Math.round(R),` C`]})]}),(0,d.jsx)(`span`,{className:`gd-hero-dash`,children:`–`}),(0,d.jsxs)(`div`,{className:`gd-hero-score-col`,children:[(0,d.jsx)(c,{value:L,className:`gd-hero-score${a?` winning`:``}${x?` score-flash`:``}`,style:a?{"--gd-side-accent":n.hex,"--gd-side-rgb":n.rgb}:void 0}),z>0&&(0,d.jsxs)(`span`,{className:`gd-cap-bonus`,children:[`+`,Math.round(z),` C`]})]})]}),(0,d.jsxs)(`div`,{className:`gd-hero-footer`,children:[(0,d.jsx)(`div`,{className:`gd-margin-chip${N&&M===`completed`&&i?` win`:N&&M===`completed`&&a?` loss`:N&&i?` up`:N&&a?` down`:``}`,style:!N&&(i||a)?{color:o.hex,borderColor:`rgba(${o.rgb},.4)`,background:`rgba(${o.rgb},.1)`}:void 0,children:N&&M===`completed`?i?(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(`i`,{className:`bi bi-trophy-fill`}),` WON BY `,Q]}):a?(0,d.jsxs)(d.Fragment,{children:[`LOST BY `,Q]}):`DRAW`:N?i?(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(`i`,{className:`bi bi-caret-up-fill`}),` UP `,Q]}):a?(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(`i`,{className:`bi bi-caret-down-fill`}),` DOWN `,Q]}):`TIED`:i?(0,d.jsxs)(d.Fragment,{children:[P,` BY `,Q]}):a?(0,d.jsxs)(d.Fragment,{children:[F,` BY `,Q]}):`DRAW`}),J!=null&&Y!=null&&M!==`completed`&&(0,d.jsxs)(`div`,{className:`gd-proj-row`,children:[(0,d.jsxs)(`span`,{className:`gd-proj-item`,children:[`Proj `,(0,d.jsx)(`b`,{children:Math.round(J)}),`–`,(0,d.jsx)(`b`,{children:Math.round(Y)})]}),(0,d.jsx)(`span`,{className:`gd-proj-sep`}),(0,d.jsxs)(`span`,{className:`gd-proj-item`,children:[`Win `,(0,d.jsxs)(`b`,{children:[Math.round(X||0),`%`]}),`–`,(0,d.jsxs)(`b`,{children:[Math.round(Z||0),`%`]})]})]}),M===`upcoming`&&j.first_bounce&&(0,d.jsxs)(`div`,{className:`gd-first-bounce`,children:[(0,d.jsx)(`i`,{className:`bi bi-clock me-1`}),`First bounce `,j.first_bounce]}),M===`completed`&&j.fixture&&(0,d.jsxs)(r,{to:`/leagues/${e}/matchup/${j.fixture.id}`,className:`gd-breakdown-link`,children:[(0,d.jsx)(`i`,{className:`bi bi-bar-chart-line`}),`Full Breakdown`]})]})]})})(),(0,d.jsxs)(`div`,{className:`d-lg-none mt-3 gd-mob-vs`,children:[(0,d.jsxs)(`div`,{className:`gd-mob-vs-header`,children:[(0,d.jsx)(`span`,{className:`gd-mob-vs-team`,children:P}),(0,d.jsxs)(`span`,{className:`gd-mob-vs-scores`,children:[(0,d.jsx)(`span`,{className:`gd-mob-vs-sc${I>L?` gd-mob-sc-win`:``}`,children:Math.round(I)}),(0,d.jsx)(`span`,{style:{color:`#484f58`,fontSize:`.7rem`},children:`v`}),(0,d.jsx)(`span`,{className:`gd-mob-vs-sc${L>I?` gd-mob-sc-win`:``}`,children:Math.round(L)})]}),(0,d.jsx)(`span`,{className:`gd-mob-vs-team`,style:{textAlign:`right`},children:F})]}),(0,d.jsxs)(`div`,{className:`gd-mob-section-hdr`,children:[(0,d.jsx)(`i`,{className:`bi bi-people-fill me-1`}),`Field`]}),(()=>{let e=e=>[...e.filter(e=>e.lineup_type===`field`&&!e.is_dnp),...e.filter(e=>e.lineup_type===`emergency`&&e.subbed_on)],t=e(B),n=e(V),r=Math.max(t.length,n.length);return Array.from({length:r}).map((e,r)=>{let i=t[r],a=n[r];return(0,d.jsxs)(`div`,{className:`gd-mob-vs-row`,children:[(0,d.jsx)(`div`,{className:`gd-mob-vs-left`,children:i&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(`span`,{className:`gd-mob-vs-name`,children:[i.is_captain&&(0,d.jsx)(`b`,{className:`gd-mob-c`,children:`C`}),i.is_vice_captain&&(0,d.jsx)(`b`,{className:`gd-mob-vc`,children:`VC`}),i.subbed_on&&(0,d.jsx)(`span`,{className:`gameday-badge-emg-active`,style:{fontSize:`.5rem`,padding:`0 3px`},children:`EMG`}),i.name]}),(0,d.jsx)(`span`,{className:`gd-mob-vs-pos pos-badge pos-${(i.position||`MID`).split(`/`)[0].toUpperCase()}`,children:(i.position||`MID`).split(`/`)[0].substring(0,3).toUpperCase()})]})}),(0,d.jsxs)(`div`,{className:`gd-mob-vs-mid`,children:[(0,d.jsxs)(`span`,{className:`gd-mob-sc-l${i?.is_live?` text-success`:``}`,children:[i?i.score||0:`-`,i?.is_live&&(0,d.jsx)(`i`,{className:`bi bi-circle-fill gameday-live-dot`})]}),(0,d.jsxs)(`span`,{className:`gd-mob-sc-r${a?.is_live?` text-success`:``}`,children:[a?a.score||0:`-`,a?.is_live&&(0,d.jsx)(`i`,{className:`bi bi-circle-fill gameday-live-dot`})]})]}),(0,d.jsx)(`div`,{className:`gd-mob-vs-right`,children:a&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(`span`,{className:`gd-mob-vs-pos pos-badge pos-${(a.position||`MID`).split(`/`)[0].toUpperCase()}`,children:(a.position||`MID`).split(`/`)[0].substring(0,3).toUpperCase()}),(0,d.jsxs)(`span`,{className:`gd-mob-vs-name`,children:[a.is_captain&&(0,d.jsx)(`b`,{className:`gd-mob-c`,children:`C`}),a.is_vice_captain&&(0,d.jsx)(`b`,{className:`gd-mob-vc`,children:`VC`}),a.subbed_on&&(0,d.jsx)(`span`,{className:`gameday-badge-emg-active`,style:{fontSize:`.5rem`,padding:`0 3px`},children:`EMG`}),a.name]})]})})]},r)})})()]}),(0,d.jsxs)(`div`,{className:`row g-3 mt-2 d-none d-lg-flex`,children:[(0,d.jsx)(`div`,{className:`col-md-6`,children:(0,d.jsx)(de,{players:B,teamName:P,score:I})}),(0,d.jsx)(`div`,{className:`col-md-6`,children:(0,d.jsx)(de,{players:V,teamName:F,score:L})})]})]}),(0,d.jsxs)(`div`,{className:`gd-foot`,children:[(0,d.jsx)(`span`,{children:M===`live`?(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(`i`,{className:`bi bi-broadcast me-1`,style:{color:`#7dc99a`}}),`Live · WebSocket sync`]}):M===`completed`?`Final results`:(0,d.jsx)(d.Fragment,{children:`\xA0`})}),(0,d.jsx)(r,{to:`/leagues/${e}/fixture`,children:`Season Fixture →`})]}),(0,d.jsxs)(`div`,{className:`gameday-all-matchups mt-4`,style:{display:`none`},children:[(0,d.jsxs)(`div`,{className:`gameday-matchups-header`,children:[(0,d.jsxs)(`span`,{children:[(0,d.jsx)(`i`,{className:`bi bi-grid-3x2-gap me-2`}),`ROUND `,j.afl_round,` MATCHUPS`]}),j.round_dates&&(0,d.jsx)(`span`,{className:`matchups-header-dates`,children:j.round_dates})]}),(0,d.jsx)(`div`,{className:`gameday-matchups-grid`,children:(j.round_fixtures||[]).map(e=>{let t=j.round_scores[String(e.home_team_id)]?.total_score||e.home_score||0,n=j.round_scores[String(e.away_team_id)]?.total_score||e.away_score||0,r=j.my_team&&(e.home_team_id===j.my_team.id||e.away_team_id===j.my_team.id),i=t>n&&e.status!==`scheduled`,a=n>t&&e.status!==`scheduled`,o=t+n||1;return(0,d.jsxs)(`div`,{className:`gameday-matchup-card${r?` matchup-yours`:``}${h===e.id?` matchup-active`:``}${r&&h!==e.id?` matchup-yours-dimmed`:``}`,onClick:()=>D(e.id),style:{cursor:`pointer`},children:[r&&(0,d.jsx)(`span`,{className:`matchup-your-tag`,children:`Your Match`}),(0,d.jsxs)(`div`,{className:`matchup-team-row`,children:[(0,d.jsx)(`span`,{className:`matchup-team-name${i?` matchup-winner`:``}`,children:e.home_team?.name}),(0,d.jsxs)(`span`,{className:`matchup-team-score`,children:[e.status!==`scheduled`&&Math.round(t),i&&(0,d.jsx)(`i`,{className:`bi bi-check-lg`,style:{color:`var(--kl-accent-green)`,fontSize:`.7rem`}})]})]}),(0,d.jsxs)(`div`,{className:`matchup-team-row`,children:[(0,d.jsx)(`span`,{className:`matchup-team-name${a?` matchup-winner`:``}`,children:e.away_team?.name}),(0,d.jsxs)(`span`,{className:`matchup-team-score`,children:[e.status!==`scheduled`&&Math.round(n),a&&(0,d.jsx)(`i`,{className:`bi bi-check-lg`,style:{color:`var(--kl-accent-green)`,fontSize:`.7rem`}})]})]}),e.status!==`scheduled`&&(0,d.jsx)(`div`,{className:`matchup-mini-bar`,children:(0,d.jsx)(`div`,{className:`matchup-mini-fill`,style:{width:`${t/o*100}%`}})}),_[e.id]&&(0,d.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center`,style:{marginTop:6},children:[(()=>{let t=k(_[e.id].home_players||[]);return t.total>0?(0,d.jsxs)(`span`,{className:`matchup-players-count`,style:{fontSize:`.6rem`,color:`var(--kl-text-faint)`},children:[t.played,`/`,t.total]}):(0,d.jsx)(`span`,{})})(),(0,d.jsxs)(`div`,{className:`d-flex gap-1`,children:[(0,d.jsx)(A,{players:_[e.id].home_players||[]}),(0,d.jsx)(A,{players:_[e.id].away_players||[]})]}),(()=>{let t=k(_[e.id].away_players||[]);return t.total>0?(0,d.jsxs)(`span`,{className:`matchup-players-count`,style:{fontSize:`.6rem`,color:`var(--kl-text-faint)`},children:[t.played,`/`,t.total]}):(0,d.jsx)(`span`,{})})()]}),e.status!==`scheduled`&&t!==n&&(0,d.jsxs)(`div`,{className:`matchup-margin`,children:[i?e.home_team?.name:e.away_team?.name,` +`,Math.round(Math.abs(t-n))]})]},e.id)})})]})]})}export{m as GamedayPage};