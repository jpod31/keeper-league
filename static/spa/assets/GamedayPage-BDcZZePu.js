import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";import{d as r,n as i,u as a}from"./chunk-QFMPRPBF-tanTk093.js";import{n as o}from"./api-C-kTb_mu.js";import{t as s}from"./AnimatedNumber-CbTovfmp.js";import{t as c}from"./esm-vWIRKc0d.js";import{t as l}from"./clubs-anGVezqu.js";import{n as u}from"./TeamBadge-rPQCu1yA.js";var d=e(t(),1),f=n();function p(){return(0,f.jsxs)(`div`,{className:`gdsk`,children:[(0,f.jsxs)(`div`,{className:`gdsk-hero`,children:[(0,f.jsxs)(`div`,{className:`gdsk-side`,children:[(0,f.jsx)(`span`,{className:`kl-skel gdsk-logo`}),(0,f.jsx)(`span`,{className:`kl-skel gdsk-name`})]}),(0,f.jsx)(`span`,{className:`kl-skel gdsk-score`}),(0,f.jsxs)(`div`,{className:`gdsk-side gdsk-side-r`,children:[(0,f.jsx)(`span`,{className:`kl-skel gdsk-name`}),(0,f.jsx)(`span`,{className:`kl-skel gdsk-logo`})]})]}),(0,f.jsx)(`div`,{className:`gdsk-cols`,children:[0,1].map(e=>(0,f.jsx)(`div`,{className:`gdsk-col`,children:Array.from({length:10}).map((e,t)=>(0,f.jsx)(`span`,{className:`kl-skel gdsk-row`},t))},e))})]})}function ee(e){let t=e.afl_games||[],n=t.filter(e=>e.status===`live`).length,r=t.filter(e=>e.status===`complete`).length,i=t.length;return e.gameday_state===`completed`?{tone:`done`,label:`FULL TIME`,sub:i?`${i}/${i} games`:`Round complete`}:e.gameday_state===`live`?{tone:`live`,label:n>0?`LIVE, ${n} ON`:`BETWEEN GAMES`,sub:`${r}/${i} games done`}:{tone:`upcoming`,label:`PRE-MATCH`,sub:e.first_bounce?`Bounce ${e.first_bounce}`:`Awaiting first bounce`}}var m=`
/* === Gameday · Stadium broadcast =============================== */

/* Round header bar */
.gd-round-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; margin-bottom: 12px; background: rgba(19,19,22,.7); border: 1px solid rgba(220,218,231,.18); border-radius: 14px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.gd-round-title { font-size: 1rem; font-weight: 800; letter-spacing: .06em; color: #f5f5f7; margin: 0; text-transform: uppercase; }
.gd-round-dates { font-size: .8125rem; color: var(--kl-text-primary); margin-top: 3px; letter-spacing: .04em; }
.gd-round-state { display: inline-flex; align-items: center; gap: 10px; }

/* TV round clock */
.gd-clock { display: inline-flex; flex-direction: column; align-items: flex-end; padding: 5px 12px; border-radius: 10px; background: rgba(19,19,22,.55); border: 1px solid rgba(220,218,231,.22); position: relative; min-width: 118px; font-feature-settings: "tnum" 1, "zero" 0; }
.gd-clock.live { background: linear-gradient(135deg, rgba(61,140,99,.18), rgba(61,140,99,.04)); border-color: rgba(61,140,99,.45); box-shadow: 0 0 16px -4px rgba(61,140,99,.5); }
.gd-clock.upcoming { background: linear-gradient(135deg, rgba(81,78,95,.14), rgba(81,78,95,.03)); border-color: rgba(81,78,95,.35); }
.gd-clock-label { font-size: .8125rem; font-weight: 800; letter-spacing: .06em; color: #f5f5f7; line-height: 1.1; }
.gd-clock.live .gd-clock-label { color: #7dc99a; }
.gd-clock.upcoming .gd-clock-label { color: #e4e3ed; }
.gd-clock-sub { font-size: .8125rem; color: var(--kl-text-primary); letter-spacing: .06em; margin-top: 3px; text-transform: uppercase; }
.gd-clock.live::before { content: ''; position: absolute; left: -1px; top: -1px; bottom: -1px; width: 3px; background: #6db38a; border-radius: 10px 0 0 10px; animation: gdPulse 1.8s ease-in-out infinite; }

.gd-refresh { all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; color: var(--kl-text-primary); background: rgba(255,255,255,.04); border: 1px solid rgba(220,218,231,.18); transition: color .14s, background .14s; }
.gd-refresh:hover { color: #ececf1; background: rgba(255,255,255,.08); }
.gd-refresh:disabled { opacity: .4; cursor: wait; }

/* Comp toggle */
.gd-comp-toggle { display: inline-flex; background: rgba(19,19,22,.5); border: 1px solid rgba(220,218,231,.18); border-radius: 999px; padding: 3px; margin-bottom: 14px; }
.gd-comp-btn { padding: 6px 14px; border-radius: 999px; font-size: .8125rem; font-weight: 700; color: var(--kl-text-primary); text-decoration: none; border: 0; background: transparent; cursor: pointer; }
.gd-comp-btn:hover { color: #ececf1; text-decoration: none; }
.gd-comp-btn.active { background: rgba(81,78,95,.18); color: #e4e3ed; }

/* AFL ticker, broadcast pills, wrap to fit every game on one panel */
.gd-ticker { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 14px; background: rgba(19,19,22,.6); border: 1px solid rgba(220,218,231,.16); border-radius: 12px; margin-bottom: 10px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.gd-ticker-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: rgba(25,24,28,.7); border: 1px solid rgba(220,218,231,.2); text-decoration: none; font-size: .8125rem; color: #e8e7f0; font-variant-numeric: tabular-nums; transition: background .14s, border-color .14s; }
.gd-ticker-pill:hover { background: rgba(33,32,37,.85); border-color: rgba(220,218,231,.32); color: #ececf1; text-decoration: none; }
.gd-ticker-dot { width: 7px; height: 7px; border-radius: 50%; background: #b0b0bc; flex-shrink: 0; }
.gd-ticker-pill.live .gd-ticker-dot { background: #6db38a; box-shadow: 0 0 8px rgba(109,179,138,.6); animation: gdPulse 1.6s ease-in-out infinite; }
.gd-ticker-pill.upcoming .gd-ticker-dot { background: #e4e3ed; }
.gd-ticker-pill.done .gd-ticker-dot { background: #7e7c8a; }
.gd-ticker-teams { font-weight: 600; color: #ececf1; }
.gd-ticker-score { color: var(--kl-text-primary); font-size: .8125rem; }
.gd-ticker-tag { font-size: .8125rem; font-weight: 800; letter-spacing: .06em; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; }
.gd-ticker-pill.live .gd-ticker-tag { background: rgba(61,140,99,.22); color: #7dc99a; }
.gd-ticker-pill.upcoming .gd-ticker-tag { background: rgba(81,78,95,.18); color: #e4e3ed; }
.gd-ticker-pill.done .gd-ticker-tag { background: rgba(220,218,231,.16); color: var(--kl-text-primary); }

/* KL mini bar, wrap all fixtures so none get hidden */
.gd-mini-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; padding: 10px 14px; background: rgba(19,19,22,.6); border: 1px solid rgba(220,218,231,.14); border-radius: 12px; margin-bottom: 12px; }
.gd-mini-pill { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 10px; border-radius: 10px; background: rgba(25,24,28,.5); border: 1px solid rgba(220,218,231,.18); cursor: pointer; transition: background .14s, border-color .14s, transform .14s; position: relative; }
.gd-mini-pill:hover { background: rgba(33,32,37,.8); border-color: rgba(220,218,231,.32); transform: translateY(-1px); }
.gd-mini-pill.yours::before { content: ''; position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: #e4e3ed; box-shadow: 0 0 6px rgba(228,227,237,.6); }
.gd-mini-pill.active { border-color: rgba(81,78,95,.55); background: linear-gradient(135deg, rgba(81,78,95,.14), rgba(81,78,95,.03)); box-shadow: inset 0 0 0 1px rgba(81,78,95,.18); }
.gd-mini-teams { font-size: .8125rem; font-weight: 700; color: #ececf1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.gd-mini-score { font-size: .8125rem; color: var(--kl-text-primary); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }

/* Hero, neutral scoreboard with deliberate accent placement.
   Team identity = LOGO + a top accent band split 50/50. Emphasis =
   the LEADING score is coloured in its team accent (loser stays
   muted). Colour appears where it carries meaning; never paints a
   whole panel. */
.gd-hero { position: relative; border-radius: 10px; overflow: hidden; margin-bottom: 14px; background: #121215; border: 1px solid rgba(220,218,231,.18); box-shadow: 0 12px 32px -10px rgba(0,0,0,.55); }

/* Top accent band, 5px stripe split 50/50 across both sides. Each
   half holds its team's accent. Clear team identifier per side at a
   glance. */
.gd-hero-band { height: 5px; display: grid; grid-template-columns: 1fr 1fr; }
.gd-hero-band-l { background: linear-gradient(90deg, var(--gd-left-accent, rgba(220,218,231,.5)) 0%, var(--gd-left-accent, rgba(220,218,231,.5)) 60%, color-mix(in srgb, var(--gd-left-accent, rgba(220,218,231,.5)) 60%, transparent) 100%); }
.gd-hero-band-r { background: linear-gradient(90deg, color-mix(in srgb, var(--gd-right-accent, rgba(220,218,231,.5)) 60%, transparent) 0%, var(--gd-right-accent, rgba(220,218,231,.5)) 40%, var(--gd-right-accent, rgba(220,218,231,.5)) 100%); }

.gd-hero-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); position: relative; }
.gd-hero-split::after { content: ''; position: absolute; top: 26px; bottom: 26px; left: 50%; width: 1px; background: linear-gradient(to bottom, transparent, rgba(220,218,231,.22), transparent); }

.gd-hero-side { padding: 26px 28px 22px; color: #f5f5f7; position: relative; min-height: 208px; display: flex; flex-direction: column; }
.gd-hero-side.right { text-align: right; align-items: flex-end; }
.gd-hero-side:not(.right) { align-items: flex-start; }

/* Top: crest + team name (tier 2, team identity) */
.gd-hero-top { display: flex; align-items: center; gap: 14px; min-width: 0; max-width: 100%; }
.gd-hero-side.right .gd-hero-top { flex-direction: row-reverse; }

.gd-hero-crest { width: 56px; height: 56px; border-radius: 12px; background: rgba(25,24,28,.85); border: 2px solid var(--gd-side-accent, rgba(220,218,231,.4)); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; font-size: 1rem; font-weight: 900; letter-spacing: .04em; color: #f5f5f7; box-shadow: 0 6px 18px -6px rgba(0,0,0,.45); }
.gd-hero-crest img { width: 100%; height: 100%; object-fit: cover; display: block; }

.gd-hero-name { font-size: 1.05rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; line-height: 1.15; }

/* Big score (tier 1, eye lands here). Leading side gets coloured
   in its team accent + soft glow. Non-leading stays muted. */
.gd-hero-score-wrap { flex: 1; display: flex; align-items: center; padding: 16px 0 12px; }
.gd-hero-side:not(.right) .gd-hero-score-wrap { justify-content: flex-start; }
.gd-hero-side.right .gd-hero-score-wrap { justify-content: flex-end; }
.gd-hero-score { font-size: 5rem; font-weight: 900; line-height: .9; color: var(--kl-text-primary); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; letter-spacing: -.05em; transition: color .35s, text-shadow .35s; }
.gd-hero-score.leading { color: var(--gd-side-hex, #ffffff); text-shadow: 0 0 32px rgba(var(--gd-side-rgb, 224,222,234), .45); }
.gd-hero-score.pre { color: #38363e; }

.gd-hero-meta { display: flex; align-items: center; gap: 8px; font-size: .8125rem; color: var(--kl-text-primary); letter-spacing: .04em; min-height: 20px; }
.gd-hero-side.right .gd-hero-meta { justify-content: flex-end; }
.gd-hero-played { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.gd-cap-bonus { font-size: .8125rem; font-weight: 700; color: #f0d27a; letter-spacing: .06em; white-space: nowrap; }

/* C/VC badges */
.gd-role-badge { font-size: .8125rem; font-weight: 800; letter-spacing: .06em; padding: 2px 6px; border-radius: 3px; color: var(--kl-text-primary); background: rgba(220,218,231,.08); border: 1px solid rgba(220,218,231,.18); }
.gd-role-badge.active { color: #f0d27a; background: rgba(194,147,47,.16); border-color: rgba(194,147,47,.36); }
.gd-role-badge.active.vc { color: #e4e3ed; background: rgba(81,78,95,.16); border-color: rgba(81,78,95,.36); }

/* "YOU" pin, friendly sapphire, only on user's side */
.gd-hero-you { position: absolute; top: 12px; right: 14px; z-index: 2; font-size: .8125rem; font-weight: 800; letter-spacing: .06em; color: #eae8f0; padding: 2px 8px; background: rgba(81,78,95,.14); border: 1px solid rgba(81,78,95,.4); border-radius: 3px; }
.gd-hero-side.right .gd-hero-you { left: 14px; right: auto; }

/* Bottom strip, state-aware. Pre-match: no margin chip, just bounce
   time + projection. Live: margin chip + projection. Done: margin
   chip + breakdown link. */
.gd-hero-strip { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 12px 18px; background: rgba(15,15,17,.6); border-top: 1px solid rgba(220,218,231,.1); flex-wrap: wrap; }
.gd-margin-chip { display: inline-flex; align-items: center; gap: 7px; padding: 5px 14px; border-radius: 4px; font-size: .82rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #f5f5f7; background: rgba(255,255,255,.04); border: 1px solid rgba(220,218,231,.18); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }
.gd-margin-chip.win { color: #7dc99a; background: rgba(61,140,99,.14); border-color: rgba(61,140,99,.4); }
.gd-margin-chip.loss { color: #e07a6c; background: rgba(184,90,74,.14); border-color: rgba(184,90,74,.4); }
.gd-margin-chip.up { color: #7dc99a; background: rgba(61,140,99,.1); border-color: rgba(61,140,99,.3); }
.gd-margin-chip.down { color: #e07a6c; background: rgba(184,90,74,.1); border-color: rgba(184,90,74,.3); }

.gd-proj-row { display: flex; align-items: center; gap: 12px; font-size: .8125rem; color: var(--kl-text-primary); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }
.gd-proj-item b { font-weight: 700; color: #ececf1; }
.gd-proj-sep { width: 3px; height: 3px; border-radius: 50%; background: rgba(220,218,231,.4); }

.gd-first-bounce { display: inline-flex; align-items: center; gap: 6px; font-size: .82rem; color: #ececf1; font-weight: 700; letter-spacing: .04em; padding: 5px 14px; border-radius: 4px; background: rgba(81,78,95,.08); border: 1px solid rgba(81,78,95,.22); }
.gd-first-bounce i { color: #e4e3ed; }
.gd-breakdown-link { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 4px; font-size: .8125rem; font-weight: 700; color: #e4e3ed; text-decoration: none; background: rgba(81,78,95,.14); border: 1px solid rgba(81,78,95,.32); transition: background .14s; }
.gd-breakdown-link:hover { background: rgba(81,78,95,.22); color: #eae8f0; text-decoration: none; }

/* Score flash */
.score-flash { animation: gdScoreFlash 1.4s ease-out; }
@keyframes gdScoreFlash { 0% { transform: scale(1.18); filter: brightness(1.4); } 35% { transform: scale(.96); } 100% { transform: scale(1); filter: brightness(1); } }
@keyframes gdPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

/* Player card column */
.gd-pcard { background: rgba(19,19,22,.7); border: 1px solid rgba(220,218,231,.16); border-radius: 14px; overflow: hidden; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.gd-pcard-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(25,24,28,.6); border-bottom: 1px solid rgba(220,218,231,.12); }
.gd-pcard-name { font-size: .82rem; font-weight: 800; color: #f5f5f7; letter-spacing: -.01em; }
.gd-pcard-total { font-size: 1.1rem; font-weight: 800; color: #ffffff; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; }

.gd-section { display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: .8125rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--kl-text-primary); background: rgba(15,15,17,.55); border-bottom: 1px solid rgba(220,218,231,.08); border-left: 2px solid transparent; }
.gd-section.field { border-left-color: rgba(61,140,99,.55); color: #7dc99a; background: rgba(61,140,99,.05); }
.gd-section.bench { border-left-color: rgba(81,78,95,.45); color: #e4e3ed; }
.gd-section.emergency { border-left-color: rgba(194,147,47,.5); color: #c2932f; background: rgba(194,147,47,.04); }
.gd-section.dnp { border-left-color: rgba(184,90,74,.45); color: #d68a7e; }
.gd-section.nogame { color: var(--kl-text-primary); }

/* Player row, broadcast tile */
.gd-prow { display: grid; grid-template-columns: 38px 1fr auto; gap: 10px; align-items: center; padding: 9px 14px; border-bottom: 1px solid rgba(220,218,231,.06); transition: background .14s; }
.gd-prow:last-child { border-bottom: none; }
.gd-prow:hover { background: rgba(33,32,37,.45); }

.gd-pos { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 22px; border-radius: 5px; font-size: .8125rem; font-weight: 800; letter-spacing: .06em; background: rgba(220,218,231,.1); border: 1px solid rgba(220,218,231,.18); color: #e8e7f0; }
.gd-pos.def { background: #58a6ff; color: #050506; border-color: #58a6ff; }
.gd-pos.mid { background: #bc8cff; color: #050506; border-color: #bc8cff; }
.gd-pos.ruc { background: #3fb950; color: #050506; border-color: #3fb950; }
.gd-pos.fwd { background: #f0883e; color: #050506; border-color: #f0883e; }

.gd-pbody { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gd-prow-name { display: flex; align-items: center; gap: 5px; min-width: 0; }
.gd-pname { font-size: .82rem; font-weight: 600; color: #ececf1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gd-pfix { display: flex; align-items: center; gap: 4px; font-size: .8125rem; color: var(--kl-text-primary); }
.gd-pfix img { width: 12px; height: 12px; }

.gd-pbadge { font-size: .8125rem; font-weight: 800; letter-spacing: .06em; padding: 1px 4px; border-radius: 3px; line-height: 1.3; flex-shrink: 0; }
.gd-pbadge.c { background: rgba(194,147,47,.2); color: #f0d27a; border: 1px solid rgba(194,147,47,.4); }
.gd-pbadge.vc { background: rgba(81,78,95,.2); color: #e4e3ed; border: 1px solid rgba(81,78,95,.4); }
.gd-pbadge.emg { background: rgba(184,90,74,.16); color: #e07a6c; border: 1px solid rgba(184,90,74,.36); }
.gd-pbadge.emg-active { background: rgba(81,78,95,.2); color: #e4e3ed; border: 1px solid rgba(81,78,95,.4); }
.gd-pbadge.dnp { background: rgba(220,218,231,.12); color: var(--kl-text-primary); }

.gd-pscore { font-size: .98rem; font-weight: 800; color: #f5f5f7; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; display: inline-flex; align-items: center; gap: 5px; min-width: 36px; justify-content: flex-end; }
.gd-pscore.live { color: #7dc99a; }
.gd-pscore.live::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #6db38a; box-shadow: 0 0 6px rgba(109,179,138,.7); animation: gdPulse 1.6s ease-in-out infinite; }
.gd-pscore.ytp { color: var(--kl-text-primary); animation: gdPulse 2.4s ease-in-out infinite; }
.gd-pscore.dnp { color: var(--kl-text-primary); }
.gd-pscore.muted { color: #38363e; }

.gd-prow.locked .gd-pname { color: var(--kl-text-primary); }
.gd-prow.dnp { opacity: 1; }
.gd-prow.dnp .gd-pname { color: var(--kl-text-primary); }
.gd-prow.reserve { opacity: 1; }
.gd-prow.emg-standby { opacity: 1; }
.gd-prow.emg-standby .gd-pname { color: #c2932f; }
.gd-prow.subbed-on { background: rgba(61,140,99,.05); }

.gd-sub-note { font-size: .8125rem; color: var(--kl-text-primary); font-style: italic; margin-left: 4px; }

/* Footer */
.gd-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 0 4px; font-size: .8125rem; color: var(--kl-text-primary); }
.gd-foot a { color: var(--kl-text-primary); text-decoration: none; font-size: .8125rem; }
.gd-foot a:hover { color: #e4e3ed; }

/* BYE state */
.gd-bye { text-align: center; padding: 50px 24px; background: rgba(19,19,22,.6); border: 1px solid rgba(220,218,231,.16); border-radius: 18px; }
.gd-bye h4 { color: #ececf1; font-size: 1.1rem; font-weight: 700; margin: 0 0 6px; }
.gd-bye p { font-size: .85rem; color: var(--kl-text-primary); margin: 0; }

/* Mobile side-by-side (preserved from legacy) */
.gameday-round-header { margin-bottom: 10px; }
.gameday-round-title { font-size: 1.4rem; font-weight: 800; letter-spacing: 1px; color: var(--kl-text-heading); }
.gameday-round-dates { color: var(--kl-text-secondary); font-size: .8125rem; }
.gameday-state-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .8125rem; font-weight: 700; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; letter-spacing: .5px; }
.badge-upcoming { background: rgba(81,78,95,.12); color: var(--kl-accent-blue); border: 1px solid rgba(81,78,95,.25); }
.badge-live { background: rgba(35,134,54,.15); color: #3fb950; border: 1px solid rgba(35,134,54,.3); }
.badge-final { background: var(--kl-bg-elevated); color: var(--kl-text-primary); }
.badge-bye { background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.live-pulse-dot { display: inline-block; width: 7px; height: 7px; background: #3fb950; border-radius: 50%; animation: liveDotGlow 2s ease-in-out infinite; }
@keyframes liveDotGlow { 0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(63,185,80,.4); } 50% { opacity: .4; box-shadow: 0 0 10px rgba(63,185,80,.8), 0 0 20px rgba(63,185,80,.3); } }
.gameday-afl-bar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 12px; padding: 10px 14px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; }
.game-status-pill { display: inline-flex; align-items: center; gap: 6px; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 16px; padding: 4px 10px; font-size: .8125rem; text-decoration: none; color: inherit; }
.game-teams { color: var(--kl-text-primary); font-weight: 600; }
.game-afl-score { color: var(--kl-text-secondary); font-size: .8125rem; font-variant-numeric: tabular-nums; }
.game-badge-live { font-size: .8125rem; background: #238636; color: #fff; animation: pulse 2s infinite; }
.game-badge-ft { font-size: .8125rem; background: #238636; color: #fff; }
.game-badge-sched { font-size: .8125rem; background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.kl-mini-bar { display: flex; gap: 6px; margin-bottom: 8px; padding: 10px 14px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; }
.kl-mini-pill { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 10px; cursor: pointer; transition: border-color .15s, background .15s; text-align: center; }
.kl-mini-pill:hover { background: var(--kl-bg-elevated); border-color: var(--kl-border-light); }
.kl-mini-yours { border-color: var(--kl-accent-blue); }
.kl-mini-teams { font-weight: 600; font-size: .8125rem; color: var(--kl-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.kl-mini-score { font-size: .8125rem; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; }
.gameday-hero { background: radial-gradient(ellipse at 50% 0%, rgba(21,21,24,.95) 0%, var(--kl-bg-card) 70%); border: 1px solid var(--kl-border); border-radius: 16px; padding: 0; margin-bottom: 4px; position: relative; overflow: hidden; }
.gameday-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 2; }
.hero-live { border-color: rgba(35,134,54,.35); animation: glowPulse 4s ease-in-out infinite; }
.hero-live::before { background: linear-gradient(90deg, #238636, #3fb950, #238636); background-size: 200% 100%; animation: heroShimmer 3s linear infinite; }
.hero-completed { border-color: rgba(160,160,172,.2); }
.hero-completed::before { background: linear-gradient(90deg, rgba(160,160,172,.3), rgba(160,160,172,.6), rgba(160,160,172,.3)); }
.hero-upcoming { border-color: rgba(81,78,95,.2); }
.hero-upcoming::before { background: linear-gradient(90deg, #514e5f, #ececf6, #514e5f); background-size: 200% 100%; animation: heroShimmer 4s linear infinite; }
@keyframes heroShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes glowPulse { 0%, 100% { box-shadow: 0 0 20px rgba(35,134,54,.1); } 50% { box-shadow: 0 0 30px rgba(35,134,54,.15); } }
.hero-teams-row { display: flex; align-items: center; justify-content: center; padding: 20px 20px 0; gap: 0; }
.hero-team-block { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.hero-team-right { justify-content: flex-end; }
.hero-team-detail { min-width: 0; flex: 1; }
.hero-vs { font-size: .8125rem; font-weight: 800; color: var(--kl-text-faint); letter-spacing: 2px; padding: 0 14px; opacity: 1; flex-shrink: 0; }
.hero-crest { display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 14px; font-weight: 800; font-size: 1rem; letter-spacing: .5px; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.left-initial { background: linear-gradient(145deg, #0d3618, #238636, #3fb950); color: #fff; }
.right-initial { background: linear-gradient(145deg, #2b2a30, #514e5f, #bc8cff); color: #fff; }
.hero-crest-img { width: 50px; height: 50px; border-radius: 14px; object-fit: cover; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); border: 2px solid rgba(255,255,255,.08); }
.hero-team-name { color: var(--kl-text-heading); font-weight: 700; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.hero-team-meta { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.hero-players-count { font-size: .8125rem; color: var(--kl-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; }
.hero-cap-badges { display: flex; gap: 2px; }
.hero-role-badge { font-size: .8125rem; padding: 1px 4px; border-radius: 3px; font-weight: 700; background: rgba(160,160,172,.12); color: var(--kl-text-primary); line-height: 1.3; }
.hero-role-badge.role-active { background: rgba(63,185,80,.18); color: #3fb950; }
.hero-scores-area { display: flex; align-items: flex-start; justify-content: center; gap: 10px; padding: 18px 20px 16px; }
.hero-score-col { display: flex; flex-direction: column; align-items: center; min-width: 70px; }
.hero-big-score { font-size: 3.4rem; font-weight: 900; line-height: 1; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; transition: color .4s, text-shadow .4s; }
.hero-big-score.score-winning { color: #3fb950; text-shadow: 0 0 28px rgba(63,185,80,.4), 0 0 56px rgba(63,185,80,.15); }
.hero-score-dash { font-size: 2.2rem; font-weight: 300; color: var(--kl-text-faint); line-height: 1; padding-top: 8px; opacity: 1; }
.captain-bonus { color: #d29922; font-size: .8125rem; font-weight: 700; margin-top: 3px; white-space: nowrap; }
.hero-footer { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid rgba(160,160,172,.06); }
.hero-margin-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 16px; border-radius: 8px; font-size: .8125rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--kl-text-primary); background: rgba(160,160,172,.08); }
.hero-margin-chip i { font-size: .8125rem; }
.hero-proj-row { display: flex; align-items: center; gap: 10px; }
.hero-proj-item { font-size: .8125rem; color: var(--kl-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hero-proj-item b { font-weight: 700; color: var(--kl-text-secondary); }
.hero-proj-sep { width: 1px; height: 12px; background: rgba(160,160,172,.2); flex-shrink: 0; }
.hero-first-bounce { text-align: center; padding: 0 20px 12px; color: var(--kl-text-secondary); font-size: .8125rem; }
.hero-breakdown-wrap { text-align: center; padding: 0 20px 14px; }
.hero-breakdown-link { display: inline-flex; align-items: center; gap: 4px; font-size: .8125rem; font-weight: 600; color: var(--kl-accent-blue); text-decoration: none; padding: 5px 14px; border-radius: 8px; border: 1px solid rgba(236,236,246,.2); background: rgba(236,236,246,.06); transition: background .15s; }
.hero-breakdown-link:hover { background: rgba(236,236,246,.12); }
.gameday-player-card { background: var(--kl-bg-body); border: 1px solid var(--kl-bg-elevated); border-radius: 10px; overflow: hidden; }
.card-left-team { border-left: 3px solid var(--kl-accent-green); }
.card-right-team { border-left: 3px solid var(--kl-text-muted); }
.gameday-player-card-header { background: var(--kl-bg-card); padding: 10px 14px; font-weight: 600; font-size: .85rem; color: var(--kl-text-primary); border-bottom: 1px solid var(--kl-bg-elevated); display: flex; justify-content: space-between; align-items: center; }
.gameday-card-score { font-weight: 800; font-size: .95rem; color: var(--kl-text-heading); font-variant-numeric: tabular-nums; }
.gameday-player-list { max-height: 600px; overflow-y: auto; }
.gameday-player-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 14px; border-bottom: 1px solid var(--kl-bg-card); font-size: .8125rem; transition: background .15s; }
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
  background: linear-gradient(to bottom, rgba(160,160,172,.15), rgba(160,160,172,.45), rgba(160,160,172,.15));
}
.player-locked .gameday-player-name { color: var(--kl-text-secondary); }
.gameday-player-info { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
.gameday-player-name { color: var(--kl-text-primary); white-space: nowrap; }
.gameday-player-meta { color: var(--kl-text-faint); font-size: .8125rem; white-space: nowrap; }
.gameday-player-score { font-weight: 600; white-space: nowrap; color: var(--kl-text-primary); font-variant-numeric: tabular-nums; }
.gameday-live-dot { font-size: .8125rem; color: #56d364; vertical-align: middle; margin-left: 3px; animation: pulse 2s infinite; }
.gameday-player-score.text-success { color: #56d364 !important; }
.gameday-team-logo { width: 16px; height: 16px; vertical-align: middle; margin-right: 2px; }
.gameday-pos-badge { padding: 1px 5px !important; font-size: .8125rem !important; border-radius: 3px !important; line-height: 1.4; }
.gameday-badge-c { display: inline-block; background: var(--kl-accent-yellow); color: #000; font-size: .8125rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-vc { display: inline-block; background: var(--kl-accent-blue); color: #000; font-size: .8125rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-emg { display: inline-block; background: var(--kl-accent-red); color: #fff; font-size: .8125rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-dnp { display: inline-block; background: var(--kl-text-faint); color: var(--kl-text-primary); font-size: .8125rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-emg-active { background: rgba(222,220,233,.18); color: #e3e1ec; border: 1px solid rgba(222,220,233,.3); font-size: .8125rem; font-weight: 800; padding: 1px 5px; border-radius: 3px; letter-spacing: .3px; margin-right: 3px; }
.gameday-sub-note { font-size: .8125rem; color: var(--kl-text-primary); font-style: italic; }
.player-dnp { opacity: 1; }
.player-dnp .gameday-player-name { color: var(--kl-text-primary); }
.score-dnp { color: var(--kl-text-primary) !important; }
.player-emergency-standby { opacity: 1; }
.player-emergency-standby .gameday-player-name { color: #d29922; }
.score-emg-standby { color: var(--kl-border) !important; }
.player-subbed-on { background: rgba(35,134,54,.08); }
.player-reserve { opacity: 1; }
.player-reserve .gameday-player-name { color: var(--kl-text-faint); }
.score-reserve { color: var(--kl-border) !important; }
.player-yet-to-play .gameday-player-score { color: var(--kl-text-muted); }
.score-ytp { color: var(--kl-text-muted) !important; }
@keyframes ytpPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
.player-yet-to-play .gameday-player-score { animation: ytpPulse 2s ease-in-out infinite; }
.gameday-section-hdr { padding: 6px 14px; font-size: .8125rem; font-weight: 700; color: var(--kl-text-secondary); text-transform: uppercase; letter-spacing: .5px; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-bg-elevated); border-left: 3px solid transparent; }
.section-field { border-left-color: var(--kl-accent-green); background: rgba(63,185,80,.04); }
.section-bench { border-left-color: var(--kl-accent-blue); }
.section-emergency { border-left-color: #d29922; color: #d29922; background: rgba(210,153,34,.06); }
.section-dnp { color: #f85149; }
.gameday-all-matchups { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 12px; overflow: hidden; }
.gameday-matchups-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-size: .8125rem; font-weight: 700; color: var(--kl-text-secondary); text-transform: uppercase; letter-spacing: .8px; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-border); }
.matchups-header-dates { font-size: .8125rem; font-weight: 500; color: var(--kl-text-faint); text-transform: none; letter-spacing: normal; }
.gameday-matchups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 14px; }
.gameday-matchup-card { display: block; text-decoration: none; color: inherit; cursor: pointer; background: var(--kl-bg-body); border: 1px solid var(--kl-bg-elevated); border-radius: 8px; padding: 12px 14px; position: relative; transition: transform .15s, border-color .15s, box-shadow .15s; }
.gameday-matchup-card:hover { transform: translateY(-2px); border-color: var(--kl-border-light); box-shadow: 0 4px 12px rgba(0,0,0,.3); }
.matchup-yours { border-color: var(--kl-accent-blue) !important; background: rgba(81,78,95,.04); }
.matchup-your-tag { position: absolute; top: -1px; right: 10px; font-size: .8125rem; font-weight: 700; text-transform: uppercase; color: var(--kl-accent-blue); background: rgba(81,78,95,.15); padding: 2px 8px; border-radius: 0 0 6px 6px; letter-spacing: .3px; }
.matchup-team-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: .8125rem; }
.matchup-team-name { color: var(--kl-text-primary); font-weight: 500; }
.matchup-winner { color: var(--kl-text-heading); font-weight: 700; }
.matchup-team-score { font-weight: 700; font-size: .85rem; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 3px; }
.matchup-mini-bar { height: 4px; background: var(--kl-accent-red); border-radius: 2px; overflow: hidden; margin-top: 8px; opacity: 0.6; }
.matchup-mini-fill { height: 100%; background: var(--kl-accent-green); border-radius: 2px; transition: width .6s ease; }
.matchup-margin { font-size: .8125rem; color: var(--kl-text-muted); text-align: center; margin-top: 4px; font-variant-numeric: tabular-nums; }
.score-flash { animation: scorePopIn 1.5s ease-out; }
@keyframes scorePopIn { 0% { transform: scale(1.15); color: var(--kl-accent-blue); text-shadow: 0 0 8px rgba(236,236,246,.5); } 40% { transform: scale(.97); } 100% { transform: scale(1); color: inherit; text-shadow: none; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.gd-mob-section-hdr { padding: 6px 10px; font-size: .8125rem; font-weight: 700; color: #ececf6; text-transform: uppercase; letter-spacing: .5px; background: rgba(236,236,246,.05); border-bottom: 1px solid rgba(42,41,47,.3); }
@media (max-width: 767.98px) {
  /* Hero, slim down for mobile */
  .gd-hero-side { padding: 16px 16px 14px; min-height: 158px; }
  .gd-hero-top { gap: 10px; }
  .gd-hero-crest { width: 44px; height: 44px; border-radius: 10px; font-size: .82rem; border-width: 2px; }
  .gd-hero-name { font-size: .82rem; letter-spacing: .03em; }
  .gd-hero-score-wrap { padding: 10px 0 8px; }
  .gd-hero-score { font-size: 3rem; letter-spacing: -.04em; }
  .gd-hero-meta { font-size: .8125rem; gap: 5px; flex-wrap: wrap; row-gap: 4px; }
  .gd-hero-side.right .gd-hero-meta { justify-content: flex-end; }
  .gd-cap-bonus { font-size: .8125rem; }
  .gd-hero-strip { padding: 10px 14px; gap: 8px; font-size: .8125rem; }
  .gd-margin-chip { font-size: .8125rem; padding: 4px 11px; }
  .gd-first-bounce { font-size: .8125rem; padding: 4px 11px; }
  .gd-proj-row { gap: 8px; font-size: .8125rem; }
  .gd-hero-you { font-size: .8125rem; padding: 2px 6px; top: 10px; right: 12px; }
  .gd-hero-side.right .gd-hero-you { left: 12px; right: auto; }

  /* Legacy classes (kept harmless for any straggling Jinja paths) */
  .gameday-hero { border-radius: 16px; margin: 0 -4px 8px; }
  .hero-teams-row { padding: 16px 14px 0; }
  .hero-big-score { font-size: 2.8rem; min-width: 55px; letter-spacing: -.04em; }
  .hero-score-dash { font-size: 1.4rem; padding-top: 8px; opacity: 1; }
  .hero-scores-area { padding: 16px 14px 14px; }
  .hero-team-name { font-size: .82rem; font-weight: 800; }
  .hero-crest { width: 44px; height: 44px; font-size: .9rem; border-radius: 12px; }
  .hero-crest-img { width: 44px; height: 44px; border-radius: 12px; }
  .hero-team-block { gap: 10px; }
  .hero-vs { padding: 0 6px; font-size: .8125rem; opacity: 1; }
  .hero-footer { padding: 10px 14px 14px; gap: 6px; }
  .hero-margin-chip { font-size: .8125rem; padding: 5px 14px; border-radius: 10px; }
  .gameday-player-row { padding: 8px 12px; font-size: .8125rem; border-bottom: 1px solid rgba(42,41,47,.2); }
  .gameday-player-row:last-child { border-bottom: none; }
  .gameday-player-meta { display: none; }
  .gameday-player-name { font-weight: 700; color: #ebebee; }
  .gameday-player-score { font-weight: 800; font-size: .88rem; font-variant-numeric: tabular-nums; }
  .gameday-round-title { font-size: 1rem; font-weight: 800; letter-spacing: -.01em; }
  .gameday-matchups-grid { grid-template-columns: 1fr; gap: 8px; padding: 10px; }
  .gameday-pos-badge { display: none !important; }
  .gameday-section-hdr { font-size: .8125rem; padding: 5px 12px; letter-spacing: .8px; }
  .gameday-player-card-header { padding: 8px 12px; font-size: .82rem; font-weight: 800; }
  .kl-mini-bar { gap: 4px; padding: 8px 10px; border-radius: 12px; margin-bottom: 8px; }
  .kl-mini-pill { font-size: .8125rem; padding: 6px 10px; border-radius: 8px; }
  .kl-mini-yours { border-color: rgba(236,236,246,.3); box-shadow: 0 0 0 1px rgba(236,236,246,.15) inset; }
  .comp-toggle { margin-bottom: 8px; }
  .comp-toggle-btn { font-size: .8125rem; padding: 6px 16px; }
}
`;function h(){let e=u(),{leagueId:t}=a(),[n]=r(),h=n.get(`fixture`),g=n.get(`round`),[_,te]=(0,d.useState)(null),[ne,re]=(0,d.useState)(!0),[v,y]=(0,d.useState)(h?Number(h):null),[b,x]=(0,d.useState)({}),[S,ie]=(0,d.useState)(!1),[ae,oe]=(0,d.useState)(!1),C=(0,d.useRef)({left:0,right:0}),w=(0,d.useCallback)(()=>{o(`/leagues/${t}/gameday?format=json${g?`&round=${g}`:``}`).then(e=>{te(e),!v&&e.fixture&&y(e.fixture.id)}).catch(()=>{}).finally(()=>re(!1))},[t,g]),se=(0,d.useCallback)(()=>{_&&o(`/leagues/${t}/gameday/api/fixtures?round=${_.afl_round}`).then(e=>{let t={};e.fixtures?.forEach(e=>{t[e.fixture_id]=e}),x(t)}).catch(()=>{})},[t,_?.afl_round]);(0,d.useEffect)(()=>{w();let e=setInterval(w,6e4);return()=>clearInterval(e)},[w]),(0,d.useEffect)(()=>{h&&y(Number(h))},[h]),(0,d.useEffect)(()=>{_?.gameday_state},[_?.gameday_state]);let ce=(0,d.useRef)(null),le=(0,d.useRef)(0),ue=_?.gameday_state===`live`&&!!_?.live_enabled,T=_?.afl_round;(0,d.useEffect)(()=>{if(!ue)return;let e=c(`/matchups`,{withCredentials:!0,reconnection:!0,reconnectionAttempts:1/0,reconnectionDelay:2e3,reconnectionDelayMax:3e4});return ce.current=e,e.on(`connect`,()=>{e.emit(`join_live`,{league_id:Number(t),afl_round:T}),e.emit(`request_scores`,{league_id:Number(t),afl_round:T})}),e.on(`score_update`,e=>{e.seq&&e.seq<=le.current||(e.seq&&(le.current=e.seq),e.fixtures&&x(t=>{let n={...t};return e.fixtures.forEach(e=>{n[e.fixture_id]=e}),n}))}),()=>{e.disconnect(),ce.current=null}},[t,ue,T]);let de=(0,d.useRef)(!1);(0,d.useEffect)(()=>{_&&!de.current&&(de.current=!0,se())},[_,se]);let E=(0,d.useCallback)(e=>{y(e)},[]),fe=(0,d.useCallback)(async()=>{ie(!0);try{await o(`/leagues/${t}/gameday/sync-scores`,{method:`POST`}).catch(()=>{}),w()}finally{setTimeout(()=>ie(!1),1e3)}},[t,w]);if((0,d.useEffect)(()=>{if(_?.gameday_state!==`upcoming`)return;let e=setInterval(()=>{o(`/leagues/${t}/gameday/api/fixtures?round=${_.afl_round}`).then(e=>{}).catch(()=>{})},3e5);return()=>clearInterval(e)},[_?.gameday_state,_?.afl_round,t]),ne)return(0,f.jsx)(p,{});if(!_)return(0,f.jsx)(`p`,{className:`text-danger`,children:`Failed to load gameday`});let D=new Set(_.teams_playing||[]);function O(e){let t=new Set([`field`,`reserve`]),n=e.filter(e=>t.has(e.lineup_type)&&(D.size===0||D.has(e.afl_team)));return{played:n.filter(e=>e.game_started&&((e.score||0)>0||e.is_dnp)).length,total:n.length}}function pe(e){let t=!1,n=!1,r=!1,i=!1;return e.forEach(e=>{let a=e.game_started&&((e.score||0)>0||e.is_dnp);e.is_captain&&(t=!0,n=a),e.is_vice_captain&&(r=!0,i=a)}),{hasCap:t,capPlayed:n,hasVc:r,vcPlayed:i}}function k({players:e,rs:t}){let n=t&&t.has_captain!==void 0?{hasCap:!!t.has_captain,capPlayed:!!t.captain_played,hasVc:!!t.has_vc,vcPlayed:!!t.vc_played}:pe(e);return(0,f.jsxs)(`span`,{style:{display:`inline-flex`,gap:4},children:[n.hasCap&&(0,f.jsx)(`span`,{className:`gd-role-badge${n.capPlayed?` active`:``}`,children:`C`}),n.hasVc&&(0,f.jsx)(`span`,{className:`gd-role-badge vc${n.vcPlayed?` active`:``}`,children:`VC`})]})}let A=_,j=A.gameday_state,M=!v||v===A.fixture?.id,N,P,F,I,L,R,z,B,V,H,U,W,G,K,q=null,J=null,Y=null,X=null;if(M||!b[v])N=A.my_team?.name||``,P=A.opp_team?.name||``,F=A.my_score,I=A.opp_score,L=A.my_captain_bonus,R=A.opp_captain_bonus,z=A.my_players||[],B=A.opp_players||[],V=A.my_team?.logo_url,H=A.opp_team?.logo_url,G=A.my_team?.id,K=A.opp_team?.id,M&&A.projections&&(q=A.projections.my_projected,J=A.projections.opp_projected,Y=A.projections.my_win_pct,X=A.projections.opp_win_pct);else{let e=b[v],t=A.round_fixtures.find(e=>e.id===v);N=t?.home_team?.name||``,P=t?.away_team?.name||``,F=e.home_score||0,I=e.away_score||0,L=e.home_captain_bonus||0,R=e.away_captain_bonus||0,z=e.home_players||[],B=e.away_players||[],V=t?.home_team?.logo_url,H=t?.away_team?.logo_url,G=t?.home_team_id,K=t?.away_team_id,e.projections&&(q=e.projections.home_projected,J=e.projections.away_projected,Y=e.projections.home_win_pct,X=e.projections.away_win_pct)}G!=null&&(U=A.round_scores?.[String(G)]),K!=null&&(W=A.round_scores?.[String(K)]);let Z=Math.abs(Math.round(F-I));if(F!==C.current.left||I!==C.current.right){if((C.current.left!==0||C.current.right!==0)&&(setTimeout(()=>{oe(!0),setTimeout(()=>oe(!1),1500)},0),typeof navigator<`u`&&navigator.vibrate))try{navigator.vibrate(12)}catch{}C.current={left:F,right:I}}function Q(e){return[...e].sort((e,t)=>{let n=e.game_kickoff||`zzzz`,r=t.game_kickoff||`zzzz`;if(n!==r)return n<r?-1:1;let i=e.afl_team||``,a=t.afl_team||``;return i===a?(e.name||``).localeCompare(t.name||``):i.localeCompare(a)})}function $({p:e}){let t=!e.game_started&&j===`live`,n=e.subbed_on,r=e.is_emergency&&!n,i=[`gd-prow`,!!(e.player_id&&A.locked_player_ids?.includes(e.player_id))&&`locked`,e.is_dnp&&`dnp`,n&&`subbed-on`,e.lineup_type===`reserve`&&`reserve`,r&&`emg-standby`,t&&`ytp`].filter(Boolean).join(` `),a=[`gd-pscore`,e.is_dnp&&`dnp`,(e.lineup_type===`reserve`||r)&&`muted`,t&&`ytp`,e.is_live&&!t&&!r&&`live`].filter(Boolean).join(` `),o=(e.position||``).split(`/`)[0].toUpperCase(),s=`gd-pos ${o.toLowerCase()}`;return(0,f.jsxs)(`div`,{className:i,style:{...l(e.afl_team),"--pc":o?`var(--pos-${o.toLowerCase()})`:`#5a5a66`},children:[(0,f.jsx)(`span`,{className:s,children:o||`-`}),(0,f.jsxs)(`div`,{className:`gd-pbody`,children:[(0,f.jsxs)(`div`,{className:`gd-prow-name`,children:[e.is_captain&&(0,f.jsx)(`span`,{className:`gd-pbadge c`,children:`C`}),e.is_vice_captain&&(0,f.jsx)(`span`,{className:`gd-pbadge vc`,children:`VC`}),n&&(0,f.jsx)(`span`,{className:`gd-pbadge emg-active`,children:`EMG`}),e.is_dnp&&!n&&(0,f.jsx)(`span`,{className:`gd-pbadge dnp`,children:`DNP`}),r&&(0,f.jsx)(`span`,{className:`gd-pbadge emg`,children:`EMG`}),(0,f.jsx)(`span`,{className:`gd-pname`,children:e.name})]}),(0,f.jsxs)(`div`,{className:`gd-pfix`,children:[e.afl_team&&A.team_logos[e.afl_team]?(0,f.jsx)(`img`,{src:A.team_logos[e.afl_team],alt:e.afl_team,title:e.afl_team}):(0,f.jsx)(`span`,{children:e.afl_team}),A.afl_matchup_info[e.afl_team]&&(0,f.jsx)(`span`,{children:A.afl_matchup_info[e.afl_team]}),e.replaces&&(0,f.jsxs)(`span`,{className:`gd-sub-note`,children:[`→ for `,e.replaces]})]})]}),(0,f.jsx)(`span`,{className:a,children:e.lineup_type===`reserve`||r?`–`:t?(0,f.jsx)(f.Fragment,{children:(0,f.jsx)(`i`,{className:`bi bi-clock`,style:{fontSize:`.8125rem`}})}):e.score||0})]})}function me({players:e,teamName:t,score:n}){let r=e=>D.size===0||D.has(e.afl_team),i=e.filter(e=>e.lineup_type===`field`&&!e.is_dnp&&r(e)),a=e.filter(e=>e.lineup_type===`emergency`&&e.subbed_on&&r(e)),o=Q([...i,...a]),s=Q(e.filter(e=>e.lineup_type===`reserve`&&r(e))),c=Q(e.filter(e=>e.lineup_type===`emergency`&&!e.subbed_on&&r(e))),l=Q(e.filter(e=>e.is_dnp&&r(e))),u=Q(e.filter(e=>!r(e)));return(0,f.jsxs)(`div`,{className:`gd-pcard`,children:[(0,f.jsxs)(`div`,{className:`gd-pcard-header`,children:[(0,f.jsx)(`span`,{className:`gd-pcard-name`,children:t}),j!==`upcoming`&&(0,f.jsx)(`span`,{className:`gd-pcard-total`,children:Math.round(n)})]}),(0,f.jsxs)(`div`,{children:[(0,f.jsxs)(`div`,{className:`gd-section field`,children:[(0,f.jsx)(`i`,{className:`bi bi-broadcast`}),`Field `,o.length]}),o.map((e,t)=>(0,f.jsx)($,{p:e},t)),s.length>0&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(`div`,{className:`gd-section bench`,children:[(0,f.jsx)(`i`,{className:`bi bi-arrow-left-right`}),`Bench `,s.length]}),s.map((e,t)=>(0,f.jsx)($,{p:e},`b${t}`))]}),c.length>0&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(`div`,{className:`gd-section emergency`,children:[(0,f.jsx)(`i`,{className:`bi bi-shield-exclamation`}),`Emergency `,c.length]}),c.map((e,t)=>(0,f.jsx)($,{p:e},`e${t}`))]}),l.length>0&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(`div`,{className:`gd-section dnp`,children:[(0,f.jsx)(`i`,{className:`bi bi-x-circle`}),`Did Not Play `,l.length]}),l.map((e,t)=>(0,f.jsx)($,{p:e},`d${t}`))]}),u.length>0&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(`div`,{className:`gd-section nogame`,children:[(0,f.jsx)(`i`,{className:`bi bi-calendar-x`}),`No Game `,u.length]}),u.map((e,t)=>(0,f.jsx)($,{p:e},`ng${t}`))]})]})]})}return A.is_bye&&A.in_season===!1?(0,f.jsxs)(`div`,{className:`kx-page tx-page`,children:[(0,f.jsx)(`div`,{className:`kx-head`,children:(0,f.jsx)(`h2`,{children:`Gameday`})}),(0,f.jsx)(`p`,{className:`tx-none`,children:`No games on. The season is finished and the next one starts after the draft.`}),(0,f.jsxs)(`div`,{style:{display:`flex`,gap:8},children:[(0,f.jsx)(i,{className:`kx-btn kx-btn-gold`,to:`/leagues/${t}`,children:`Home`}),(0,f.jsx)(i,{className:`kx-btn`,to:`/leagues/${t}/seasons`,children:`Last season`})]})]}):(0,f.jsxs)(`div`,{children:[(0,f.jsx)(`style`,{children:m}),(0,f.jsxs)(`div`,{className:`gd-comp-toggle`,children:[(0,f.jsx)(`span`,{className:`gd-comp-btn active`,children:`Main`}),(0,f.jsx)(i,{to:`/leagues/${t}/reserve7s/gameday`,className:`gd-comp-btn`,children:`7s`})]}),(0,f.jsxs)(`div`,{className:`gd-round-bar`,children:[(0,f.jsxs)(`div`,{children:[(0,f.jsx)(`div`,{className:`gd-round-title`,children:A.afl_round===0?`Opening Round`:`Round ${A.afl_round}`}),A.round_dates&&(0,f.jsx)(`div`,{className:`gd-round-dates`,children:A.round_dates})]}),(0,f.jsxs)(`div`,{className:`gd-round-state`,children:[(()=>{let e=ee(A);return(0,f.jsxs)(`div`,{className:`gd-clock ${e.tone}`,children:[(0,f.jsx)(`span`,{className:`gd-clock-label`,children:e.label}),(0,f.jsx)(`span`,{className:`gd-clock-sub`,children:e.sub})]})})(),(0,f.jsx)(`button`,{className:`gd-refresh`,onClick:fe,disabled:S,title:`Sync scores`,children:S?(0,f.jsx)(`span`,{className:`spinner-border spinner-border-sm`,style:{width:12,height:12}}):(0,f.jsx)(`i`,{className:`bi bi-arrow-clockwise`})})]})]}),A.afl_games&&A.afl_games.length>0&&(()=>{let e=e=>e===`live`?0:e===`complete`?2:1;return(0,f.jsx)(`div`,{className:`gd-ticker d-none d-lg-flex`,children:[...A.afl_games].sort((t,n)=>e(t.status)-e(n.status)).map(e=>{let n=e.status===`live`?`live`:e.status===`complete`?`done`:`upcoming`,r=A.team_abbr[e.home_team]||e.home_team.substring(0,3).toUpperCase(),a=A.team_abbr[e.away_team]||e.away_team.substring(0,3).toUpperCase();return(0,f.jsxs)(i,{to:`/leagues/${t}/gameday/afl-game/${e.game_id}`,className:`gd-ticker-pill ${n}`,children:[(0,f.jsx)(`span`,{className:`gd-ticker-dot`}),(0,f.jsxs)(`span`,{className:`gd-ticker-teams`,children:[r,` v `,a]}),e.home_score!=null&&(0,f.jsxs)(`span`,{className:`gd-ticker-score`,children:[e.home_score,`-`,e.away_score]}),(0,f.jsx)(`span`,{className:`gd-ticker-tag`,children:e.status===`live`?`LIVE`:e.status===`complete`?`FT`:e.scheduled_display||(e.scheduled_start?e.scheduled_start.substring(11,16):`TBC`)})]},e.game_id)})})})(),A.round_fixtures&&A.round_fixtures.length>0&&(0,f.jsx)(`div`,{className:`gd-mini-bar`,children:A.round_fixtures.map(e=>{let t=b[e.id],n=t?.home_score??A.round_scores[String(e.home_team_id)]?.total_score??0,r=t?.away_score??A.round_scores[String(e.away_team_id)]?.total_score??0,i=!!(A.my_team&&(e.home_team_id===A.my_team.id||e.away_team_id===A.my_team.id)),a=v===e.id;return(0,f.jsxs)(`div`,{className:[`gd-mini-pill`,a&&`active`,i&&!a&&`yours`].filter(Boolean).join(` `),onClick:()=>E(e.id),children:[(0,f.jsxs)(`span`,{className:`gd-mini-teams`,children:[e.home_team?.name,` v `,e.away_team?.name]}),e.status!==`scheduled`&&(0,f.jsxs)(`span`,{className:`gd-mini-score`,children:[Math.round(n),`-`,Math.round(r)]})]},e.id)})}),A.is_bye?(0,f.jsxs)(`div`,{className:`gd-bye`,children:[(0,f.jsxs)(`h4`,{children:[(0,f.jsx)(`i`,{className:`bi bi-dash-circle me-2`}),`Bye this round`]}),(0,f.jsx)(`p`,{children:`Click any matchup above to view it.`})]}):(0,f.jsxs)(f.Fragment,{children:[(()=>{let n=e(G),r=e(K),a=F>I,o=I>F,c=j===`upcoming`,l=U?.players_total==null?O(z):{played:U.players_played??0,total:U.players_total},u=W?.players_total==null?O(B):{played:W.players_played??0,total:W.players_total},d={"--gd-side-accent":`rgba(${n.rgb},.6)`,"--gd-side-hex":n.hex,"--gd-side-rgb":n.rgb},p={"--gd-side-accent":`rgba(${r.rgb},.6)`,"--gd-side-hex":r.hex,"--gd-side-rgb":r.rgb},ee={"--gd-left-accent":n.hex,"--gd-right-accent":r.hex},m=`gd-hero-score${c?` pre`:a?` leading`:``}${ae?` score-flash`:``}`,h=`gd-hero-score${c?` pre`:o?` leading`:``}${ae?` score-flash`:``}`;return(0,f.jsxs)(`div`,{className:`gd-hero`,children:[(0,f.jsxs)(`div`,{className:`gd-hero-band`,style:ee,children:[(0,f.jsx)(`span`,{className:`gd-hero-band-l`}),(0,f.jsx)(`span`,{className:`gd-hero-band-r`})]}),(0,f.jsxs)(`div`,{className:`gd-hero-split`,children:[(0,f.jsxs)(`div`,{className:`gd-hero-side`,style:d,children:[(0,f.jsxs)(`div`,{className:`gd-hero-top`,children:[(0,f.jsx)(`span`,{className:`gd-hero-crest`,children:V?(0,f.jsx)(`img`,{src:V,alt:``}):N.substring(0,2).toUpperCase()}),(0,f.jsx)(`span`,{className:`gd-hero-name`,children:N})]}),(0,f.jsx)(`div`,{className:`gd-hero-score-wrap`,children:(0,f.jsx)(s,{value:F,className:m})}),(0,f.jsxs)(`div`,{className:`gd-hero-meta`,children:[l.total>0&&(0,f.jsxs)(`span`,{className:`gd-hero-played`,children:[l.played,`/`,l.total,` played`]}),(0,f.jsx)(k,{players:z,rs:U}),L>0&&(0,f.jsxs)(`span`,{className:`gd-cap-bonus`,children:[`+`,Math.round(L),` C`]})]})]}),(0,f.jsxs)(`div`,{className:`gd-hero-side right`,style:p,children:[(0,f.jsxs)(`div`,{className:`gd-hero-top`,children:[(0,f.jsx)(`span`,{className:`gd-hero-crest`,children:H?(0,f.jsx)(`img`,{src:H,alt:``}):P.substring(0,2).toUpperCase()}),(0,f.jsx)(`span`,{className:`gd-hero-name`,children:P})]}),(0,f.jsx)(`div`,{className:`gd-hero-score-wrap`,children:(0,f.jsx)(s,{value:I,className:h})}),(0,f.jsxs)(`div`,{className:`gd-hero-meta`,children:[R>0&&(0,f.jsxs)(`span`,{className:`gd-cap-bonus`,children:[`+`,Math.round(R),` C`]}),(0,f.jsx)(k,{players:B,rs:W}),u.total>0&&(0,f.jsxs)(`span`,{className:`gd-hero-played`,children:[u.played,`/`,u.total,` played`]})]})]})]}),(0,f.jsx)(`div`,{className:`gd-hero-strip`,children:j===`upcoming`?(0,f.jsxs)(f.Fragment,{children:[A.first_bounce&&(0,f.jsxs)(`span`,{className:`gd-first-bounce`,children:[(0,f.jsx)(`i`,{className:`bi bi-clock-fill`}),`First bounce `,A.first_bounce]}),q!=null&&J!=null&&(0,f.jsxs)(`div`,{className:`gd-proj-row`,children:[(0,f.jsxs)(`span`,{className:`gd-proj-item`,children:[`Proj `,(0,f.jsx)(`b`,{children:Math.round(q)}),`–`,(0,f.jsx)(`b`,{children:Math.round(J)})]}),(0,f.jsx)(`span`,{className:`gd-proj-sep`}),(0,f.jsxs)(`span`,{className:`gd-proj-item`,children:[`Win `,(0,f.jsxs)(`b`,{children:[Math.round(Y||0),`%`]}),`–`,(0,f.jsxs)(`b`,{children:[Math.round(X||0),`%`]})]})]})]}):j===`completed`?(0,f.jsxs)(f.Fragment,{children:[(a||o)&&(0,f.jsx)(`div`,{className:`gd-margin-chip${M&&a?` win`:M&&o?` loss`:``}`,children:M?a?(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`i`,{className:`bi bi-trophy-fill`}),`WON BY `,Z]}):(0,f.jsxs)(f.Fragment,{children:[`LOST BY `,Z]}):a?(0,f.jsxs)(f.Fragment,{children:[N,` BY `,Z]}):(0,f.jsxs)(f.Fragment,{children:[P,` BY `,Z]})}),!a&&!o&&(0,f.jsx)(`div`,{className:`gd-margin-chip`,children:`DRAW`}),A.fixture&&(0,f.jsxs)(i,{to:`/leagues/${t}/matchup/${A.fixture.id}`,className:`gd-breakdown-link`,children:[(0,f.jsx)(`i`,{className:`bi bi-bar-chart-line`}),`Full Breakdown`]})]}):(0,f.jsxs)(f.Fragment,{children:[(a||o)&&(0,f.jsx)(`div`,{className:`gd-margin-chip${M&&a?` up`:M&&o?` down`:``}`,children:M?a?(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`i`,{className:`bi bi-caret-up-fill`}),`UP `,Z]}):(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`i`,{className:`bi bi-caret-down-fill`}),`DOWN `,Z]}):a?(0,f.jsxs)(f.Fragment,{children:[N,` BY `,Z]}):(0,f.jsxs)(f.Fragment,{children:[P,` BY `,Z]})}),q!=null&&J!=null&&(0,f.jsxs)(`div`,{className:`gd-proj-row`,children:[(0,f.jsxs)(`span`,{className:`gd-proj-item`,children:[`Proj `,(0,f.jsx)(`b`,{children:Math.round(q)}),`–`,(0,f.jsx)(`b`,{children:Math.round(J)})]}),(0,f.jsx)(`span`,{className:`gd-proj-sep`}),(0,f.jsxs)(`span`,{className:`gd-proj-item`,children:[`Win `,(0,f.jsxs)(`b`,{children:[Math.round(Y||0),`%`]}),`–`,(0,f.jsxs)(`b`,{children:[Math.round(X||0),`%`]})]})]})]})})]})})(),(0,f.jsxs)(`div`,{className:`d-lg-none mt-3 gd-mob-vs`,children:[(0,f.jsxs)(`div`,{className:`gd-mob-vs-header`,children:[(0,f.jsx)(`span`,{className:`gd-mob-vs-team`,children:N}),(0,f.jsxs)(`span`,{className:`gd-mob-vs-scores`,children:[(0,f.jsx)(`span`,{className:`gd-mob-vs-sc${F>I?` gd-mob-sc-win`:``}`,children:Math.round(F)}),(0,f.jsx)(`span`,{style:{color:`var(--kl-text-primary)`,fontSize:`.8125rem`},children:`v`}),(0,f.jsx)(`span`,{className:`gd-mob-vs-sc${I>F?` gd-mob-sc-win`:``}`,children:Math.round(I)})]}),(0,f.jsx)(`span`,{className:`gd-mob-vs-team`,style:{textAlign:`right`},children:P})]}),(0,f.jsxs)(`div`,{className:`gd-mob-section-hdr`,children:[(0,f.jsx)(`i`,{className:`bi bi-people-fill me-1`}),`Field`]}),(()=>{let e=e=>Q([...e.filter(e=>e.lineup_type===`field`&&!e.is_dnp),...e.filter(e=>e.lineup_type===`emergency`&&e.subbed_on)]),t=e(z),n=e(B),r=Math.max(t.length,n.length);return Array.from({length:r}).map((e,r)=>{let i=t[r],a=n[r];return(0,f.jsxs)(`div`,{className:`gd-mob-vs-row`,children:[(0,f.jsx)(`div`,{className:`gd-mob-vs-left`,children:i&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(`span`,{className:`gd-mob-vs-name`,children:[i.is_captain&&(0,f.jsx)(`b`,{className:`gd-mob-c`,children:`C`}),i.is_vice_captain&&(0,f.jsx)(`b`,{className:`gd-mob-vc`,children:`VC`}),i.subbed_on&&(0,f.jsx)(`span`,{className:`gameday-badge-emg-active`,style:{fontSize:`.8125rem`,padding:`0 3px`},children:`EMG`}),i.name]}),(0,f.jsx)(`span`,{className:`gd-mob-vs-pos pos-badge pos-${(i.position||`MID`).split(`/`)[0].toUpperCase()}`,children:(i.position||`MID`).split(`/`)[0].toUpperCase().replace(`FLEX`,`FLX`).substring(0,3)})]})}),(0,f.jsxs)(`div`,{className:`gd-mob-vs-mid`,children:[(0,f.jsxs)(`span`,{className:`gd-mob-sc-l${i?.is_live?` text-success`:``}`,children:[i?i.score||0:`-`,i?.is_live&&(0,f.jsx)(`i`,{className:`bi bi-circle-fill gameday-live-dot`})]}),(0,f.jsxs)(`span`,{className:`gd-mob-sc-r${a?.is_live?` text-success`:``}`,children:[a?a.score||0:`-`,a?.is_live&&(0,f.jsx)(`i`,{className:`bi bi-circle-fill gameday-live-dot`})]})]}),(0,f.jsx)(`div`,{className:`gd-mob-vs-right`,children:a&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`span`,{className:`gd-mob-vs-pos pos-badge pos-${(a.position||`MID`).split(`/`)[0].toUpperCase()}`,children:(a.position||`MID`).split(`/`)[0].toUpperCase().replace(`FLEX`,`FLX`).substring(0,3)}),(0,f.jsxs)(`span`,{className:`gd-mob-vs-name`,children:[a.is_captain&&(0,f.jsx)(`b`,{className:`gd-mob-c`,children:`C`}),a.is_vice_captain&&(0,f.jsx)(`b`,{className:`gd-mob-vc`,children:`VC`}),a.subbed_on&&(0,f.jsx)(`span`,{className:`gameday-badge-emg-active`,style:{fontSize:`.8125rem`,padding:`0 3px`},children:`EMG`}),a.name]})]})})]},r)})})()]}),(0,f.jsxs)(`div`,{className:`row g-3 mt-2 d-none d-lg-flex`,children:[(0,f.jsx)(`div`,{className:`col-md-6`,children:(0,f.jsx)(me,{players:z,teamName:N,score:F})}),(0,f.jsx)(`div`,{className:`col-md-6`,children:(0,f.jsx)(me,{players:B,teamName:P,score:I})})]})]}),(0,f.jsxs)(`div`,{className:`gd-foot`,children:[(0,f.jsx)(`span`,{children:j===`live`?(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`i`,{className:`bi bi-broadcast me-1`,style:{color:`#7dc99a`}}),`Live, WebSocket sync`]}):j===`completed`?`Final results`:(0,f.jsx)(f.Fragment,{children:`\xA0`})}),(0,f.jsx)(i,{to:`/leagues/${t}/fixture`,children:`Season Fixture →`})]}),(0,f.jsxs)(`div`,{className:`gameday-all-matchups mt-4`,style:{display:`none`},children:[(0,f.jsxs)(`div`,{className:`gameday-matchups-header`,children:[(0,f.jsxs)(`span`,{children:[(0,f.jsx)(`i`,{className:`bi bi-grid-3x2-gap me-2`}),`ROUND `,A.afl_round,` MATCHUPS`]}),A.round_dates&&(0,f.jsx)(`span`,{className:`matchups-header-dates`,children:A.round_dates})]}),(0,f.jsx)(`div`,{className:`gameday-matchups-grid`,children:(A.round_fixtures||[]).map(e=>{let t=A.round_scores[String(e.home_team_id)]?.total_score||e.home_score||0,n=A.round_scores[String(e.away_team_id)]?.total_score||e.away_score||0,r=A.my_team&&(e.home_team_id===A.my_team.id||e.away_team_id===A.my_team.id),i=t>n&&e.status!==`scheduled`,a=n>t&&e.status!==`scheduled`,o=t+n||1;return(0,f.jsxs)(`div`,{className:`gameday-matchup-card${r?` matchup-yours`:``}${v===e.id?` matchup-active`:``}${r&&v!==e.id?` matchup-yours-dimmed`:``}`,onClick:()=>E(e.id),style:{cursor:`pointer`},children:[r&&(0,f.jsx)(`span`,{className:`matchup-your-tag`,children:`Your Match`}),(0,f.jsxs)(`div`,{className:`matchup-team-row`,children:[(0,f.jsx)(`span`,{className:`matchup-team-name${i?` matchup-winner`:``}`,children:e.home_team?.name}),(0,f.jsxs)(`span`,{className:`matchup-team-score`,children:[e.status!==`scheduled`&&Math.round(t),i&&(0,f.jsx)(`i`,{className:`bi bi-check-lg`,style:{color:`var(--kl-accent-green)`,fontSize:`.8125rem`}})]})]}),(0,f.jsxs)(`div`,{className:`matchup-team-row`,children:[(0,f.jsx)(`span`,{className:`matchup-team-name${a?` matchup-winner`:``}`,children:e.away_team?.name}),(0,f.jsxs)(`span`,{className:`matchup-team-score`,children:[e.status!==`scheduled`&&Math.round(n),a&&(0,f.jsx)(`i`,{className:`bi bi-check-lg`,style:{color:`var(--kl-accent-green)`,fontSize:`.8125rem`}})]})]}),e.status!==`scheduled`&&(0,f.jsx)(`div`,{className:`matchup-mini-bar`,children:(0,f.jsx)(`div`,{className:`matchup-mini-fill`,style:{width:`${t/o*100}%`}})}),b[e.id]&&(0,f.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center`,style:{marginTop:6},children:[(()=>{let t=O(b[e.id].home_players||[]);return t.total>0?(0,f.jsxs)(`span`,{className:`matchup-players-count`,style:{fontSize:`.8125rem`,color:`var(--kl-text-faint)`},children:[t.played,`/`,t.total]}):(0,f.jsx)(`span`,{})})(),(0,f.jsxs)(`div`,{className:`d-flex gap-1`,children:[(0,f.jsx)(k,{players:b[e.id].home_players||[]}),(0,f.jsx)(k,{players:b[e.id].away_players||[]})]}),(()=>{let t=O(b[e.id].away_players||[]);return t.total>0?(0,f.jsxs)(`span`,{className:`matchup-players-count`,style:{fontSize:`.8125rem`,color:`var(--kl-text-faint)`},children:[t.played,`/`,t.total]}):(0,f.jsx)(`span`,{})})()]}),e.status!==`scheduled`&&t!==n&&(0,f.jsxs)(`div`,{className:`matchup-margin`,children:[i?e.home_team?.name:e.away_team?.name,` +`,Math.round(Math.abs(t-n))]})]},e.id)})})]})]})}export{h as GamedayPage};