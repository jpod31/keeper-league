import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";import{d as r,l as i,n as a}from"./chunk-QFMPRPBF-CEu2oS-5.js";import{n as ee}from"./api-C-kTb_mu.js";import{i as o,o as te,s as ne}from"./TeamCrest-CnszfbdM.js";import{i as re,n as ie,r as s}from"./clubs-Ms_nAsV-.js";import{n as c,r as ae}from"./dialog-rFtmqvkT.js";import{n as oe,t as se}from"./useWishlist-Av55RM8P.js";var l=e(t(),1),u=n();function ce(){return(0,u.jsxs)(`div`,{className:`drsk`,children:[(0,u.jsxs)(`div`,{className:`drsk-clock`,children:[(0,u.jsx)(`span`,{className:`kl-skel drsk-timer`}),(0,u.jsx)(`span`,{className:`kl-skel drsk-onclock`})]}),(0,u.jsxs)(`div`,{className:`drsk-cols`,children:[(0,u.jsxs)(`div`,{className:`drsk-col drsk-col-list`,children:[(0,u.jsx)(`span`,{className:`kl-skel drsk-filter`}),Array.from({length:14}).map((e,t)=>(0,u.jsx)(`span`,{className:`kl-skel drsk-row`},t))]}),(0,u.jsxs)(`div`,{className:`drsk-col drsk-col-board`,children:[(0,u.jsx)(`span`,{className:`kl-skel drsk-board-head`}),Array.from({length:6}).map((e,t)=>(0,u.jsx)(`span`,{className:`kl-skel drsk-board-row`},t))]})]}),(0,u.jsx)(`div`,{className:`drsk-history`,children:Array.from({length:8}).map((e,t)=>(0,u.jsx)(`span`,{className:`kl-skel drsk-pick`},t))})]})}var le=[{key:`sc_average`,label:`SC Avg`},{key:`age_factor`,label:`Longevity`},{key:`positional_scarcity`,label:`Scarcity`},{key:`trajectory`,label:`Trajectory`},{key:`durability`,label:`Durability`},{key:`rating_potential`,label:`Ceiling`}],ue=[`#e4e3ed`,`#7dc99a`,`#c2932f`,`#e07a6c`,`#e6e4ee`,`#e2e0eb`,`#d68a7e`,`#f0d27a`],de=`
/* === Draft room · Stadium ====================================== */

/* Banner, current pick + timer. Overrides the legacy GitHub-toned
   rules in global style.css. */
.draft-banner {
  background: rgba(19,19,22,.7) !important;
  border: 1px solid rgba(220,218,231,.18) !important;
  border-radius: 14px !important;
  padding: 16px 22px !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 14px !important;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.draft-banner-your-pick {
  border-color: rgba(81,78,95,.55) !important;
  background: linear-gradient(135deg, rgba(81,78,95,.14), rgba(81,78,95,.02)) !important;
  box-shadow: 0 0 32px -10px rgba(81,78,95,.4);
}
.draft-banner-complete {
  border-color: rgba(61,140,99,.5) !important;
  background: linear-gradient(135deg, rgba(61,140,99,.1), transparent) !important;
}
.draft-pick-badge {
  width: 52px !important;
  height: 52px !important;
  border-radius: 12px !important;
  background: rgba(25,24,28,.85) !important;
  border: 1px solid rgba(220,218,231,.3) !important;
  color: #f5f5f7 !important;
  font-size: 1.2rem !important;
  font-weight: 800 !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.02em;
}
.draft-banner-your-pick .draft-pick-badge {
  background: rgba(81,78,95,.18) !important;
  border-color: rgba(81,78,95,.5) !important;
  color: #eae8f0 !important;
}
.draft-pick-badge.scheduled { background: rgba(81,78,95,.12) !important; border-color: rgba(81,78,95,.32) !important; color: #e4e3ed !important; }
.draft-timer {
  font-size: 2.4rem !important;
  font-weight: 900 !important;
  font-family: inherit !important;
  color: #ffffff !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.03em;
  line-height: 1;
  transition: color .15s, text-shadow .15s;
}
.draft-timer.timer-urgent {
  color: #e07a6c !important;
  text-shadow: 0 0 20px rgba(184,90,74,.5);
  animation: draftPulse 1s ease-in-out infinite;
}
@keyframes draftPulse { 0%, 100% { opacity: 1; } 50% { opacity: .65; } }
.draft-timer-label {
  font-size: .8125rem !important;
  letter-spacing: .06em !important;
  text-transform: uppercase;
  color: var(--kl-text-primary) !important;
  font-weight: 700 !important;
  margin-top: 4px !important;
}
.draft-banner-round { font-size: .8125rem; color: var(--kl-text-primary); letter-spacing: .06em; text-transform: uppercase; font-weight: 800; }
.draft-banner-team { font-size: 1.15rem; font-weight: 800; color: #f5f5f7; letter-spacing: -.005em; }
.draft-your-pick-pill {
  display: inline-flex;
  align-items: center;
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: .06em;
  padding: 3px 9px;
  border-radius: 4px;
  background: rgba(81,78,95,.2);
  color: #eae8f0;
  border: 1px solid rgba(81,78,95,.5);
  text-transform: uppercase;
  margin-left: 10px;
}

/* Pre-draft event card */
.draft-event {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 18px 22px;
  border-radius: 14px;
  background: rgba(19,19,22,.7);
  border: 1px solid rgba(220,218,231,.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
}
.draft-event::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, rgba(81,78,95,.6) 0%, rgba(221,219,232,.6) 50%, rgba(184,127,61,.6) 100%);
}
.draft-event-countdown {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f5f5f7;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.01em;
  line-height: 1.1;
  margin-top: 4px;
}
.draft-event-countdown.soon { color: #7dc99a; }
.draft-event-time { font-size: .82rem; color: var(--kl-text-primary); }

/* Status pill on page header */
.conn-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6db38a;
  box-shadow: 0 0 6px rgba(109,179,138,.5);
}
.conn-dot.off { background: #e07a6c; box-shadow: 0 0 6px rgba(224,122,108,.5); }
.draft-header-info { font-size: .8125rem; color: var(--kl-text-primary); letter-spacing: .02em; }

/* Available players card */
.draft-avail-tbl { width: 100%; font-size: .82rem; }
.draft-avail-tbl thead th {
  font-size: .8125rem !important;
  font-weight: 800 !important;
  letter-spacing: .06em !important;
  color: var(--kl-text-primary) !important;
  background: rgba(15,15,17,.7) !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid rgba(220,218,231,.18) !important;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 2;
}
.draft-avail-tbl tbody td {
  padding: 8px 12px;
  font-size: .82rem;
  border-bottom: 1px solid rgba(220,218,231,.06);
  color: #ececf1;
  vertical-align: middle;
}
.draft-avail-tbl tbody tr { transition: background .14s; }
.draft-avail-tbl tbody tr:hover { background: rgba(81,78,95,.06); }
.draft-avail-tbl tbody tr:hover .player-name { color: #eae8f0; }
.draft-avail-tbl .player-name { font-weight: 600; color: #f5f5f7; white-space: nowrap; }
.draft-avail-tbl .stat-cell { font-weight: 700; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; text-align: right; }
.draft-avail-tbl tbody tr.blocked { opacity: .45; }

/* Sortable headers */
.sortable-th { cursor: pointer; user-select: none; white-space: nowrap; transition: color .14s; }
.sortable-th:hover { color: #e8e7f0 !important; }
.sortable-th .sort-icon { display: inline-block; margin-left: 4px; font-size: .8125rem; opacity: .25; transition: opacity .14s, color .14s; }
.sortable-th.active-sort { color: #ececf1 !important; }
.sortable-th.active-sort .sort-icon { opacity: 1; color: #e4e3ed; }

/* Position chips, match Gameday DEF/MID/RUC/FWD palette */
.draft-pos-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 22px; border-radius: 5px;
  font-size: .8125rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  background: rgba(220,218,231,.1); border: 1px solid rgba(220,218,231,.18); color: #e8e7f0;
}
.draft-pos-chip.def { background: rgba(61,138,156,.14); color: #7ec0d3; border-color: rgba(61,138,156,.3); }
.draft-pos-chip.mid { background: rgba(81,78,95,.14); color: #e4e3ed; border-color: rgba(81,78,95,.3); }
.draft-pos-chip.ruc { background: rgba(221,219,232,.14); color: #e6e4ee; border-color: rgba(221,219,232,.3); }
.draft-pos-chip.fwd { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.3); }

/* Rating / potential / draft-score numeric chips */
.draft-stat-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 22px; padding: 0 7px; border-radius: 5px;
  font-size: .8125rem; font-weight: 800; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
  background: rgba(220,218,231,.1); border: 1px solid rgba(220,218,231,.18); color: #e8e7f0;
}
.draft-stat-chip.tier-elite { background: rgba(194,147,47,.2); color: #f0d27a; border-color: rgba(194,147,47,.45); box-shadow: 0 0 10px -2px rgba(194,147,47,.3); }
.draft-stat-chip.tier-good { background: rgba(81,78,95,.16); color: #e4e3ed; border-color: rgba(81,78,95,.35); }
.draft-stat-chip.tier-ok { background: rgba(221,219,232,.12); color: #e6e4ee; border-color: rgba(221,219,232,.3); }
.draft-stat-chip.tier-low { background: rgba(184,90,74,.1); color: #d68a7e; border-color: rgba(184,90,74,.25); }
.draft-stat-chip.tier-empty { color: var(--kl-text-primary); background: transparent; border-color: transparent; }
.draft-stat-chip.draft-score { background: rgba(81,78,95,.18); color: #eae8f0; border-color: rgba(81,78,95,.4); }

/* Position-need chips (sit above filter row) */
.draft-need-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .8125rem; padding: 3px 9px; border-radius: 6px;
  font-weight: 700; letter-spacing: .04em;
  background: rgba(220,218,231,.1); border: 1px solid rgba(220,218,231,.18); color: #e8e7f0;
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
}
.draft-need-chip.met { background: rgba(61,140,99,.12); color: #7dc99a; border-color: rgba(61,140,99,.3); }
.draft-need-chip.short { background: rgba(194,147,47,.12); color: #f0d27a; border-color: rgba(194,147,47,.3); }
.draft-need-chip.blocked { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.36); }
.draft-need-chip.north { background: rgba(81,78,95,.12); color: #e4e3ed; border-color: rgba(81,78,95,.32); }

/* Filter row */
.draft-filter-input, .draft-filter-select {
  background: rgba(19,19,22,.55) !important;
  border: 1px solid rgba(220,218,231,.2) !important;
  color: #ececf1 !important;
  border-radius: 8px !important;
  padding: 7px 12px !important;
  font-size: .8125rem !important;
  height: auto !important;
}
.draft-filter-input:focus, .draft-filter-select:focus { border-color: rgba(81,78,95,.55) !important; outline: 0 !important; box-shadow: 0 0 0 2px rgba(81,78,95,.15) !important; }
.draft-filter-input::placeholder { color: var(--kl-text-primary); }

/* Values panel (weight sliders) */
.draft-values-panel {
  background: rgba(15,15,17,.6);
  border: 1px solid rgba(220,218,231,.16);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.draft-values-row { display: flex; align-items: center; gap: 12px; margin-bottom: 9px; }
.draft-values-row:last-of-type { margin-bottom: 4px; }
.draft-values-label { font-size: .8125rem; color: var(--kl-text-primary); font-weight: 700; letter-spacing: .04em; width: 68px; flex-shrink: 0; }
.draft-values-value { font-size: .8125rem; color: #e4e3ed; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; min-width: 36px; text-align: right; font-weight: 700; }
.draft-values-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(220,218,231,.12); }
.draft-values-foot-meta { font-size: .8125rem; color: var(--kl-text-primary); }
.draft-values-foot-meta .custom { color: #7dc99a; font-weight: 700; }

input[type="range"].draft-slider {
  appearance: none;
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: rgba(220,218,231,.2);
  border-radius: 2px;
  outline: none;
}
input[type="range"].draft-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #514e5f;
  border: 2px solid #f5f5f7;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.4);
}
input[type="range"].draft-slider::-moz-range-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #514e5f;
  border: 2px solid #f5f5f7;
  cursor: pointer;
}

/* Right column, pick history / your team / chat cards */
.draft-right-col { display: flex; flex-direction: column; max-height: calc(100vh - 160px); gap: 14px; }
.draft-right-col > .card {
  flex-shrink: 1;
  min-height: 180px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(19,19,22,.7) !important;
  border: 1px solid rgba(220,218,231,.18) !important;
  border-radius: 12px !important;
}
.draft-right-col > .card > .card-body { overflow-y: auto; flex: 1; min-height: 0; }
.draft-right-col .card-header {
  background: rgba(25,24,28,.55) !important;
  border-bottom: 1px solid rgba(220,218,231,.12) !important;
  padding: 11px 14px !important;
  color: #ececf1;
}
.draft-right-col .card-header h5 { color: #f5f5f7; font-size: .88rem; font-weight: 800; letter-spacing: -.005em; }
.draft-right-col .card-header .badge {
  background: rgba(220,218,231,.16) !important;
  color: #e8e7f0 !important;
  font-size: .8125rem !important;
  font-weight: 700 !important;
  padding: 3px 8px !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
}

/* Tables inside right-col cards */
.draft-right-col table { color: #ececf1; margin: 0; }
.draft-right-col table thead th {
  font-size: .8125rem !important;
  font-weight: 800 !important;
  letter-spacing: .06em !important;
  color: var(--kl-text-primary) !important;
  background: rgba(15,15,17,.75) !important;
  padding: 8px 10px !important;
  border-bottom: 1px solid rgba(220,218,231,.18) !important;
  text-transform: uppercase;
}
.draft-right-col table tbody td {
  padding: 6px 10px !important;
  border-bottom: 1px solid rgba(220,218,231,.06) !important;
  font-size: .8125rem;
  color: #ececf1;
  vertical-align: middle;
}
.draft-right-col table tbody tr { transition: background .14s; }
.draft-right-col table tbody tr:hover { background: rgba(81,78,95,.05); }
.draft-pick-row-mine td { background: rgba(81,78,95,.08); color: #eae8f0 !important; }
.draft-pick-row-mine .player-name { color: #eae8f0 !important; }
.draft-auto-tag { color: var(--kl-text-primary); font-size: .8125rem; letter-spacing: .02em; }
.draft-pass-tag { color: #f0d27a; font-weight: 800; font-size: .8125rem; letter-spacing: .06em; }

/* Your-team grouping section */
.draft-yt-section {
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--kl-text-primary);
  background: rgba(15,15,17,.6);
  padding: 6px 12px;
  border-left: 2px solid rgba(220,218,231,.3);
}
.draft-yt-section.def { color: #7ec0d3; border-left-color: rgba(61,138,156,.5); }
.draft-yt-section.mid { color: #e4e3ed; border-left-color: rgba(81,78,95,.45); }
.draft-yt-section.ruc { color: #e6e4ee; border-left-color: rgba(221,219,232,.5); }
.draft-yt-section.fwd { color: #e07a6c; border-left-color: rgba(184,90,74,.45); }

/* Chat, wider re-skin */
.draft-chat-card { flex-shrink: 0; flex-grow: 0; min-height: auto !important; }
.draft-chat-card #chat-messages { max-height: 180px; }
.chat-msg { padding: 5px 12px; font-size: .8125rem; border-bottom: 1px solid rgba(220,218,231,.06); }
.chat-msg:last-child { border-bottom: none; }
.chat-msg-name { font-weight: 800; font-size: .8125rem; margin-right: 6px; letter-spacing: .02em; }
.chat-msg-text { color: #ececf1; word-break: break-word; }
.chat-msg-system { text-align: center; font-size: .8125rem; color: var(--kl-text-primary); font-style: italic; padding: 4px 12px; }
.chat-toggle-collapsed { transform: rotate(-90deg); }

/* Mobile */
@media (max-width: 991.98px) {
  .draft-banner { flex-direction: column; gap: 10px; text-align: center; padding: 14px !important; }
  .draft-banner .draft-pick-badge { width: 40px !important; height: 40px !important; font-size: .9rem !important; }
  .draft-timer { font-size: 1.7rem !important; }
  .draft-event { flex-direction: column; align-items: stretch; text-align: center; }
  .draft-right-col { max-height: none; padding-bottom: 80px; }
  .col-lg-5 > .card, .col-lg-7 > .card { max-height: 50vh !important; }
  .draft-chat-card { max-height: none !important; }
}
`;function fe(e){if(e<=0)return`Starting soon...`;let t=Math.floor(e/1e3),n=Math.floor(t/86400),r=Math.floor(t%86400/3600),i=Math.floor(t%3600/60),a=t%60;return n>0?`${n}d ${r}h ${i}m`:r>0?`${r}h ${i}m ${a}s`:i>0?`${i}m ${a}s`:`${a}s`}function d(e){return e?e.split(`/`)[0].toLowerCase():`mid`}function f(){let{leagueId:e}=r(),t=ne(),n=te().league?.club_logos??{},[f,p]=(0,l.useState)(null),pe=i(),[m,me]=(0,l.useState)(null),[h,he]=(0,l.useState)(null),[ge,_e]=(0,l.useState)(!0),[g,_]=(0,l.useState)(null),[v,ve]=(0,l.useState)([]),[y,ye]=(0,l.useState)(null),[be,xe]=(0,l.useState)([]),[Se,Ce]=(0,l.useState)(``),[b,we]=(0,l.useState)(``),[x,Te]=(0,l.useState)(``),[S,Ee]=(0,l.useState)(``),[C,De]=(0,l.useState)(`draft_score`),[w,Oe]=(0,l.useState)(`desc`),[T,E]=(0,l.useState)({}),[ke,Ae]=(0,l.useState)(!1),[je,Me]=(0,l.useState)(!1),[Ne,Pe]=(0,l.useState)(`all`),[D,O]=(0,l.useState)(null),[Fe,k]=(0,l.useState)(!1),[Ie,A]=(0,l.useState)(!1),[j,Le]=(0,l.useState)(!1),[M,Re]=(0,l.useState)([]),[N,ze]=(0,l.useState)(`queue`),Be=se(e),P=(0,l.useMemo)(()=>new Set(M.map(e=>e.player_id)),[M]),[F,Ve]=(0,l.useState)(()=>typeof window<`u`&&window.innerWidth>=992),[I,L]=(0,l.useState)([]),[R,He]=(0,l.useState)(``),[Ue,We]=(0,l.useState)(0),z=(0,l.useRef)(null),B=(0,l.useRef)({}),[Ge,Ke]=(0,l.useState)(``),[qe,Je]=(0,l.useState)(``),V=(0,l.useRef)(null);(0,l.useEffect)(()=>{_e(!0),ee(`/leagues/${e}/draft?format=json`).then(e=>{if(`empty_state`in e){he(e);return}me(e),_(e.state),E(e.user_weights),Me(e.has_custom_weights),e.session.scheduled_start&&Ke(e.session.scheduled_start.slice(0,16))}).catch(()=>{}).finally(()=>_e(!1))},[e]),(0,l.useEffect)(()=>{V.current&&window.clearInterval(V.current);let e=m?.session.scheduled_start;if(!e||g?.status!==`scheduled`){Je(e?``:`No time set`);return}let t=()=>{Je(fe(new Date(e).getTime()-Date.now()))};return t(),V.current=window.setInterval(t,1e3),()=>{V.current&&window.clearInterval(V.current)}},[m?.session.scheduled_start,g?.status]);let H=(0,l.useCallback)(()=>{m?.user_team&&fetch(`/leagues/${e}/draft/api/position_needs`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>{e.error||ye(e)}).catch(()=>{})},[e,m?.user_team]),U=(0,l.useCallback)(()=>{m?.user_team&&fetch(`/leagues/${e}/draft/api/team_picks/${m.user_team.id}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>xe(Array.isArray(e)?e:[])).catch(()=>{})},[e,m?.user_team]),W=(0,l.useCallback)(()=>{let t=le.map(e=>`w_${e.key}=${T[e.key]??.2}`).join(`&`),n=S||x===`new`?800:200,r=new URLSearchParams;r.set(`q`,Se),b&&r.set(`pos`,b),r.set(`limit`,String(n)),fetch(`/leagues/${e}/draft/api/available?${r.toString()}&${t}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>ve(Array.isArray(e)?e:[])).catch(()=>ve([]))},[e,Se,b,S,x===`new`,T]),G=(0,l.useCallback)(()=>{m?.user_team&&fetch(`/leagues/${e}/draft/api/queue`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>Re(Array.isArray(e)?e:[])).catch(()=>{})},[e,m?.user_team]),Ye=(0,l.useCallback)(t=>{fetch(`/leagues/${e}/draft/api/queue`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({player_id:t}),credentials:`same-origin`}).then(()=>G()).catch(()=>{})},[e,G]),K=(0,l.useCallback)(t=>{fetch(`/leagues/${e}/draft/api/queue`,{method:`DELETE`,headers:{"Content-Type":`application/json`},body:JSON.stringify({player_id:t}),credentials:`same-origin`}).then(()=>G()).catch(()=>{})},[e,G]);(0,l.useEffect)(()=>{m&&W()},[m,W]),(0,l.useEffect)(()=>{m&&(H(),U(),G())},[m,H,U,G]),(0,l.useEffect)(()=>{m&&fetch(`/leagues/${e}/draft/api/chat_history`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>L(Array.isArray(e)?e:[])).catch(()=>{})},[e,m]),(0,l.useEffect)(()=>{z.current&&(z.current.scrollTop=z.current.scrollHeight)},[I,F]);let{socket:q,state:Xe}=oe({namespace:`/draft`,onConnect:t=>t.emit(`join_draft`,{league_id:Number(e)}),events:{draft_state:e=>{_(e),H(),U(),W(),G()},pick_made:e=>{let t=e;_(e=>e&&{...e,pick_history:[t,...e.pick_history],picks_made:e.picks_made+1,picked_player_ids:t.player_id?[...e.picked_player_ids,t.player_id]:e.picked_player_ids}),L(e=>[...e,{team_name:t.team_name,message:t.is_pass?`${t.team_name} passed`:`${t.team_name} drafted ${t.player_name}`,is_system:!0}]),t.player_id&&Re(e=>e.filter(e=>e.player_id!==t.player_id)),t.is_pass||(p(t),window.setTimeout(()=>p(e=>e===t?null:e),4500)),H(),W(),t.team_id===m?.user_team?.id&&U()},timer_tick:e=>{let{remaining:t}=e;_(e=>e&&{...e,timer_remaining:t})},draft_completed:e=>{_({...e,status:`completed`})},draft_chat_msg:e=>{let t=e;L(e=>[...e,t]),F||We(e=>e+1)},schedule_updated:e=>{let{scheduled_start:t}=e;me(e=>e&&{...e,session:{...e.session,scheduled_start:t}}),t&&Ke(t.slice(0,16))},error:e=>ae(e.message)}}),Ze=(0,l.useMemo)(()=>{let e=v.filter(e=>!(g&&e.id!=null&&g.picked_player_ids.includes(e.id)));x===`new`?e=e.filter(e=>!!e.is_new):x&&(e=e.filter(e=>e.age==null?!1:x===`30+`?e.age>=30:x===`25-30`?e.age>=25&&e.age<=30:e.age<parseInt(x))),S&&(e=e.filter(e=>e.afl_team===S));let t=w===`asc`?1:-1;return e.slice().sort((e,n)=>{let r=e[C],i=n[C];return r==null&&i==null?0:r==null?1:i==null?-1:typeof r==`string`&&typeof i==`string`?t*r.localeCompare(i):t*(r-i)}).slice(0,100)},[v,x,S,C,w,g]),Qe=(0,l.useMemo)(()=>{let e=new Set;return v.forEach(t=>{t.afl_team&&e.add(t.afl_team)}),[...e].sort()},[v]),$e=e=>{C===e?Oe(e=>e===`desc`?`asc`:`desc`):(De(e),Oe([`name`,`position`,`afl_team`].includes(e)?`asc`:`desc`))},et=e=>C===e?w===`desc`?`bi-chevron-down`:`bi-chevron-up`:`bi-chevron-expand`,tt=!!(m?.user_team&&g?.current_team_id===m.user_team.id),J=g?.status===`in_progress`&&(tt||m?.is_commissioner&&j);function nt(e){return!y||!y.blocked_positions.length||!e?!1:e.split(`/`).map(e=>e.trim().toUpperCase()).every(e=>y.blocked_positions.includes(e))}function Y(e){if(!q?.connected){ae(`Not connected, refresh the page.`);return}O(e)}function rt(){D==null||!q||(q.emit(`make_pick`,{league_id:Number(e),player_id:D}),O(null))}function it(){q?.emit(`pass_pick`,{league_id:Number(e)}),k(!1)}function at(e){if(!B.current[e]){let t=Object.keys(B.current).length;B.current[e]=ue[t%ue.length]}return B.current[e]}function ot(){!R.trim()||!q||(q.emit(`draft_chat`,{league_id:Number(e),message:R.trim()}),He(``))}function st(){let e=!F;Ve(e),e&&We(0)}function ct(e,t){E(n=>({...n,[e]:t}))}function lt(){W()}async function ut(){try{let t=await(await fetch(`/leagues/${e}/draft/api/save_weights`,{method:`POST`,credentials:`same-origin`,headers:{"Content-Type":`application/json`},body:JSON.stringify(T)})).json();t.status===`ok`&&(t.weights&&E(t.weights),Me(!0),W())}catch{}}function dt(){q?.emit(`update_schedule`,{league_id:Number(e),scheduled_start:Ge||null})}function ft(){q?.emit(`start_draft`,{league_id:Number(e)})}async function pt(){await c(`Pause the draft? All timers will stop.`)&&q?.emit(`pause_draft`,{league_id:Number(e)})}function mt(){q?.emit(`resume_draft`,{league_id:Number(e)})}async function ht(){await c(`Undo the last pick?`)&&q?.emit(`undo_pick`,{league_id:Number(e)})}async function gt(){if(!await c(`Are you sure you want to restart the draft?

This will DELETE the current draft session, remove all drafted players from rosters, and take you to settings where you can make changes before re-drafting.

This cannot be undone.`))return;let t=new FormData;t.set(`action`,`restart_draft`),fetch(`/leagues/${e}/draft/setup`,{method:`POST`,body:t,credentials:`same-origin`}).then(()=>pe(`/leagues/${e}/settings`))}async function _t(){let t=new FormData;try{await fetch(`/leagues/${e}/draft/api/end`,{method:`POST`,body:t,credentials:`same-origin`}),A(!1)}catch{}}if(ge)return(0,u.jsx)(ce,{});if(h)return(0,u.jsx)(`div`,{children:(0,u.jsxs)(`div`,{className:`empty-state`,children:[(0,u.jsx)(`div`,{className:`empty-icon`,children:(0,u.jsx)(`i`,{className:`bi bi-list-check`})}),(0,u.jsx)(`h4`,{children:`No draft scheduled yet`}),(0,u.jsx)(`p`,{children:h.is_commissioner?`Set up a draft session to get everyone in the room. While you wait, you can plan your picks in the player pool.`:`Your commissioner hasn't scheduled the next draft. You can still browse the player pool and plan your picks.`}),(0,u.jsxs)(`div`,{className:`d-flex justify-content-center gap-2 flex-wrap`,children:[(0,u.jsxs)(a,{to:`/leagues/${e}/player-pool`,className:`btn btn-primary btn-sm`,children:[(0,u.jsx)(`i`,{className:`bi bi-search me-1`}),`Browse player pool`]}),h.is_commissioner&&(0,u.jsxs)(a,{to:`/leagues/${e}/draft/setup`,className:`btn btn-outline-primary btn-sm`,children:[(0,u.jsx)(`i`,{className:`bi bi-calendar-plus me-1`}),`Set up draft`]}),(0,u.jsxs)(a,{to:`/leagues/${e}/player-ratings`,className:`btn btn-outline-secondary btn-sm`,children:[(0,u.jsx)(`i`,{className:`bi bi-star me-1`}),`Player ratings`]})]})]})});if(!m||!g)return(0,u.jsx)(`p`,{className:`text-danger`,children:`Failed to load draft room`});let{league:vt,user_team:X,is_commissioner:yt,can_restart:bt,session:Z}=m,xt=Z.scheduled_start?new Date(Z.scheduled_start):null,St=xt?xt.toLocaleDateString(`en-AU`,{weekday:`short`,day:`numeric`,month:`short`})+`, `+xt.toLocaleTimeString(`en-AU`,{hour:`numeric`,minute:`2-digit`}):``,Ct=D==null?null:v.find(e=>e.id===D),Q=e=>{let t=g.teams.find(t=>t.id===e);return t?{id:t.id,name:t.name,logo:t.logo??null,accent:t.accent??`#ececf6`}:void 0},wt=tt&&g.status===`in_progress`,$=g.status===`completed`,Tt=(Ne===`mine`&&X?g.pick_history.filter(e=>e.team_name===X.name):g.pick_history).slice().sort((e,t)=>t.pick_number-e.pick_number);return(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`style`,{children:de}),(0,u.jsxs)(`div`,{className:`page-header`,children:[(0,u.jsxs)(`div`,{className:`page-breadcrumb`,children:[(0,u.jsx)(a,{to:`/leagues/${e}`,children:vt.name}),` / Draft Room`]}),(0,u.jsxs)(`div`,{className:`d-flex justify-content-between align-items-start flex-wrap gap-2`,children:[(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`h2`,{className:`mb-0`,children:`Draft room`}),(0,u.jsxs)(`div`,{className:`d-flex align-items-center gap-3 mt-1`,children:[(0,u.jsx)(`span`,{className:`conn-dot${Xe===`connected`?``:` off`}`,title:Xe===`connected`?`Connected`:`Disconnected`}),(0,u.jsx)(`span`,{className:`status-pill status-${g.status.replace(`_`,`-`)}`,children:g.status.replace(`_`,` `)}),(0,u.jsxs)(`span`,{className:`draft-header-info`,children:[(g.draft_type||vt.draft_type)===`snake`?`Snake`:`Same order every round`,`, `,Z.pick_timer_secs?`${Z.pick_timer_secs}s timer`:`no timer`]})]})]}),yt&&(0,u.jsxs)(`div`,{className:`d-flex gap-2 align-items-center flex-wrap`,children:[(0,u.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm${j?` active`:``}`,onClick:()=>Le(e=>!e),style:{fontSize:`.8125rem`},title:`Pick on behalf of other teams`,children:[(0,u.jsx)(`i`,{className:`bi bi-shield${j?`-fill-check`:``} me-1`}),j?`Override ON`:`Override`]}),g.status===`scheduled`&&(0,u.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:ft,children:[(0,u.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Start Draft`]}),g.status===`in_progress`&&(0,u.jsxs)(`button`,{className:`btn btn-outline-secondary btn-sm`,onClick:pt,children:[(0,u.jsx)(`i`,{className:`bi bi-pause-fill me-1`}),`Pause`]}),g.status===`paused`&&(0,u.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:mt,children:[(0,u.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Resume`]}),g.picks_made>0&&(g.status===`in_progress`||g.status===`paused`)&&(0,u.jsxs)(`button`,{className:`btn btn-outline-info btn-sm`,onClick:ht,style:{fontSize:`.8125rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Undo`]}),(g.status===`in_progress`||g.status===`paused`)&&(0,u.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:()=>A(!0),style:{fontSize:`.8125rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-stop-fill me-1`}),`End Draft`]}),bt&&(0,u.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:gt,style:{fontSize:`.8125rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Restart`]})]})]})]}),g.status===`scheduled`?(0,u.jsxs)(`div`,{className:`draft-event`,children:[(0,u.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,u.jsx)(`div`,{className:`draft-pick-badge scheduled`,children:(0,u.jsx)(`i`,{className:`bi bi-hourglass-split`})}),(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`div`,{className:`draft-banner-round`,children:`Draft Starts In`}),(0,u.jsx)(`div`,{className:`draft-event-countdown${qe===`Starting soon...`?` soon`:``}`,children:qe}),St&&(0,u.jsx)(`div`,{className:`draft-event-time`,children:St})]})]}),yt&&(0,u.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,u.jsx)(`input`,{type:`datetime-local`,className:`draft-filter-input`,value:Ge,onChange:e=>Ke(e.target.value),style:{width:`auto`}}),(0,u.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm`,onClick:dt,style:{fontSize:`.8125rem`,whiteSpace:`nowrap`},children:[(0,u.jsx)(`i`,{className:`bi bi-clock me-1`}),`Set Time`]})]})]}):(0,u.jsxs)(`div`,{className:`draft-banner dn-stage${wt?` draft-banner-your-pick`:``}${$?` draft-banner-complete`:``}`,style:{"--on":re(Q(g.current_team_id)?.accent)},children:[(0,u.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[!$&&(0,u.jsx)(o,{team:Q(g.current_team_id),size:68}),(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`div`,{className:`draft-banner-round`,children:$?`All picks made`:`${wt?`You are on the clock`:`On the clock`}, pick ${g.current_pick||`-`}, round ${g.current_round||`-`}`}),(0,u.jsxs)(`div`,{className:`draft-banner-team`,children:[$?`Draft Complete`:g.current_team_name||`TBD`,!$&&g.current_via_team_name&&(0,u.jsxs)(`span`,{style:{fontSize:`.7em`,fontWeight:600,color:`var(--kl-text-primary)`,marginLeft:8},children:[`via `,g.current_via_team_name]}),!$&&g.current_label&&(0,u.jsx)(`span`,{style:{fontSize:`.6em`,fontWeight:700,color:`#d29922`,marginLeft:8},children:g.current_label})]})]})]}),Z.pick_timer_secs>0?(0,u.jsxs)(`div`,{className:`draft-timer-block`,children:[(0,u.jsx)(`span`,{className:`draft-timer${(g.timer_remaining??0)<=10&&g.timer_remaining!=null?` timer-urgent`:``}`,children:$?`-`:g.timer_remaining??Z.pick_timer_secs}),(0,u.jsx)(`span`,{className:`draft-timer-label`,children:`seconds`})]}):(0,u.jsx)(`div`,{className:`draft-timer-block`,children:(0,u.jsxs)(`span`,{className:`draft-timer-label`,children:[(0,u.jsx)(`i`,{className:`bi bi-infinity me-1`}),`Untimed`]})})]}),g.upcoming&&g.upcoming.length>(g.status===`scheduled`?0:1)&&(0,u.jsxs)(`div`,{className:`dn-order`,children:[(0,u.jsx)(`span`,{className:`dn-order-label`,children:g.status===`scheduled`?`Draft order`:`Up next`}),(0,u.jsx)(`div`,{className:`dn-order-row`,children:g.upcoming.slice(g.status===`scheduled`?0:1,14).map(e=>{let t=Q(e.team_id);return(0,u.jsxs)(`span`,{className:`dn-slot${X&&e.team_id===X.id?` mine`:``}`,title:`Pick ${e.pick_number}: ${t?.name??``}${e.via_team_name?` (via ${e.via_team_name})`:``}`,children:[(0,u.jsx)(`b`,{children:e.pick_number}),(0,u.jsx)(o,{team:t,size:30}),(0,u.jsx)(`span`,{className:`dn-slot-name`,children:t?.name})]},e.pick_number)})})]}),f&&(0,u.jsxs)(`div`,{className:`dn-reveal`,style:{...ie(f.player_afl_team),"--logo":f.player_afl_team&&n[f.player_afl_team]?`url("${n[f.player_afl_team]}")`:`none`},onClick:()=>p(null),role:`status`,children:[(0,u.jsxs)(`div`,{className:`dn-reveal-top`,children:[(0,u.jsx)(o,{team:Q(f.team_id),size:34}),(0,u.jsxs)(`span`,{children:[`Pick `,f.pick_number,`, `,f.team_name]})]}),(0,u.jsxs)(`div`,{className:`dn-reveal-body`,children:[f.player_afl_team&&n[f.player_afl_team]&&(0,u.jsx)(`img`,{src:n[f.player_afl_team],alt:``}),(0,u.jsxs)(`div`,{className:`dn-reveal-who`,children:[(0,u.jsx)(`div`,{className:`dn-reveal-name`,children:f.player_name}),(0,u.jsxs)(`div`,{className:`dn-reveal-meta`,children:[f.player_position&&(0,u.jsx)(`span`,{className:`draft-pos-chip ${d(f.player_position)}`,children:f.player_position.split(`/`)[0]}),(0,u.jsx)(`span`,{children:f.player_afl_team}),f.player_age!=null&&(0,u.jsxs)(`span`,{children:[`Age `,f.player_age]})]})]}),(0,u.jsxs)(`div`,{className:`dn-reveal-nums`,children:[(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`b`,{className:`rt ${s(f.player_rating??null)}`,children:f.player_rating??`-`}),(0,u.jsx)(`span`,{children:`Rating`})]}),(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`b`,{className:`rt rt-line ${s(f.player_potential??null)}`,children:f.player_potential??`-`}),(0,u.jsx)(`span`,{children:`Potential`})]})]})]})]}),(0,u.jsxs)(`div`,{className:`row g-3`,children:[(0,u.jsx)(`div`,{className:`col-lg-7`,children:(0,u.jsxs)(`div`,{className:`card`,style:{display:`flex`,flexDirection:`column`},children:[(0,u.jsxs)(`div`,{className:`card-header`,children:[(0,u.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center mb-2`,children:[(0,u.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-people me-2`,style:{color:`var(--kl-text-primary)`}}),`Available Players`]}),(0,u.jsxs)(`div`,{className:`d-flex gap-1 align-items-center`,children:[g.status===`in_progress`&&(0,u.jsxs)(`button`,{className:`btn btn-outline-warning py-0 px-2`,onClick:()=>k(!0),disabled:!J,style:{fontSize:`.8125rem`},title:J?`Pass on this pick`:`You can pass when it’s your turn`,children:[(0,u.jsx)(`i`,{className:`bi bi-skip-forward me-1`}),`Pass`]}),(0,u.jsxs)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,type:`button`,onClick:()=>Ae(e=>!e),style:{fontSize:`.8125rem`},title:`Adjust your draft value weights`,children:[(0,u.jsx)(`i`,{className:`bi bi-sliders me-1`}),`Values`]})]})]}),ke&&(0,u.jsxs)(`div`,{className:`draft-values-panel`,children:[le.map(({key:e,label:t})=>(0,u.jsxs)(`div`,{className:`draft-values-row`,children:[(0,u.jsx)(`span`,{className:`draft-values-label`,children:t}),(0,u.jsx)(`input`,{type:`range`,className:`draft-slider`,min:0,max:1,step:.01,value:T[e]??.2,onChange:t=>ct(e,parseFloat(t.target.value))}),(0,u.jsxs)(`span`,{className:`draft-values-value`,children:[Math.round((T[e]??.2)*100),`%`]})]},e)),(0,u.jsxs)(`div`,{className:`draft-values-foot`,children:[(0,u.jsx)(`span`,{className:`draft-values-foot-meta`,children:je?(0,u.jsx)(`span`,{className:`custom`,children:`Custom`}):`League defaults`}),(0,u.jsxs)(`div`,{className:`d-flex gap-1`,children:[(0,u.jsx)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,onClick:lt,style:{fontSize:`.8125rem`},children:`Apply`}),(0,u.jsx)(`button`,{className:`btn btn-primary py-0 px-2`,onClick:ut,style:{fontSize:`.8125rem`},children:`Save`})]})]})]}),y&&X&&(0,u.jsxs)(`div`,{className:`d-flex gap-2 mb-2 flex-wrap`,children:[[`DEF`,`MID`,`FWD`,`RUC`].map(e=>{let t=y.drafted[e]??0,n=y.required[e]??0,r=y.needs[e]??0,i=y.blocked_positions.includes(e);return(0,u.jsxs)(`span`,{className:`draft-need-chip ${i?`blocked`:r>0?`short`:`met`} np-${e.toLowerCase()}`,title:i?`BLOCKED`:r>0?`${r} more needed`:`Requirement met`,children:[e,` `,t,`/`,n,i&&(0,u.jsx)(`i`,{className:`bi bi-lock-fill`,style:{fontSize:`.8125rem`}})]},e)}),(0,u.jsxs)(`span`,{className:`draft-need-chip north`,title:`North Melbourne players drafted`,children:[`NM `,y.north_count??0]})]}),(0,u.jsxs)(`div`,{className:`row g-2`,children:[(0,u.jsx)(`div`,{className:`col`,children:(0,u.jsx)(`input`,{type:`text`,className:`draft-filter-input w-100`,placeholder:`Search players...`,value:Se,onChange:e=>Ce(e.target.value)})}),(0,u.jsx)(`div`,{className:`col-auto`,children:(0,u.jsxs)(`select`,{className:`draft-filter-select`,value:b,onChange:e=>we(e.target.value),style:{width:`auto`},children:[(0,u.jsx)(`option`,{value:``,children:`All Pos`}),(0,u.jsx)(`option`,{value:`DEF`,children:`DEF`}),(0,u.jsx)(`option`,{value:`MID`,children:`MID`}),(0,u.jsx)(`option`,{value:`FWD`,children:`FWD`}),(0,u.jsx)(`option`,{value:`RUC`,children:`RUC`})]})}),(0,u.jsx)(`div`,{className:`col-auto`,children:(0,u.jsxs)(`select`,{className:`draft-filter-select`,value:x,onChange:e=>Te(e.target.value),style:{width:`auto`},children:[(0,u.jsx)(`option`,{value:``,children:`All Ages`}),(0,u.jsx)(`option`,{value:`new`,children:`New to the AFL`}),(0,u.jsx)(`option`,{value:`21`,children:`U21`}),(0,u.jsx)(`option`,{value:`23`,children:`U23`}),(0,u.jsx)(`option`,{value:`25`,children:`U25`}),(0,u.jsx)(`option`,{value:`25-30`,children:`25-30`}),(0,u.jsx)(`option`,{value:`30+`,children:`30+`})]})}),(0,u.jsx)(`div`,{className:`col-auto`,children:(0,u.jsxs)(`select`,{className:`draft-filter-select`,value:S,onChange:e=>Ee(e.target.value),style:{width:`auto`},children:[(0,u.jsx)(`option`,{value:``,children:`All Clubs`}),Qe.map(e=>(0,u.jsx)(`option`,{value:e,children:e},e))]})})]})]}),(0,u.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,overflowX:`auto`,maxHeight:`70vh`},children:(0,u.jsxs)(`table`,{className:`table table-sm mb-0 draft-avail-tbl`,children:[(0,u.jsx)(`thead`,{children:(0,u.jsxs)(`tr`,{children:[[[`name`,`Player`],[`position`,`Pos`],[`age`,`Age`],[`sc_avg`,t.tag?`SC ${t.tag}`:`SC`],[`rating`,`Rtg`],[`potential`,`Pot`],[`draft_score`,`Value`]].map(([e,t])=>(0,u.jsxs)(`th`,{className:`sortable-th${C===e?` active-sort`:``}`,onClick:()=>$e(e),children:[t,` `,(0,u.jsx)(`i`,{className:`bi sort-icon ${et(e)}`})]},e)),(0,u.jsx)(`th`,{})]})}),(0,u.jsx)(`tbody`,{children:Ze.map(e=>{let t=nt(e.position);return(0,u.jsxs)(`tr`,{className:t?`blocked`:void 0,children:[(0,u.jsxs)(`td`,{className:`player-name`,children:[(0,u.jsxs)(`span`,{className:`dn-club`,title:e.afl_team||void 0,children:[e.afl_team&&n[e.afl_team]?(0,u.jsx)(`img`,{src:n[e.afl_team],alt:``}):(0,u.jsx)(`span`,{className:`dn-club-gap`}),e.name]}),e.is_new&&(0,u.jsx)(`span`,{className:`pl-mark pl-mark-new`,children:`NEW`})]}),(0,u.jsx)(`td`,{children:e.position&&(0,u.jsx)(`span`,{className:`draft-pos-chip ${d(e.position)}${e.position_expected?` pos-expected`:``}`,title:e.position_expected?`Expected position. He has no SuperCoach position yet.`:void 0,children:e.position.split(`/`)[0]})}),(0,u.jsx)(`td`,{style:{color:`var(--kl-text-primary)`},children:e.age??`-`}),(0,u.jsx)(`td`,{className:`stat-cell`,style:{color:`#e8e7f0`},children:e.sc_avg==null?`-`:e.sc_avg.toFixed(1)}),(0,u.jsx)(`td`,{className:`stat-cell`,children:(0,u.jsx)(`span`,{className:`rt ${s(e.rating)}`,children:e.rating??`–`})}),(0,u.jsx)(`td`,{className:`stat-cell`,children:(0,u.jsx)(`span`,{className:`rt rt-line ${s(e.potential)}`,children:e.potential??`–`})}),(0,u.jsx)(`td`,{className:`stat-cell`,children:(0,u.jsx)(`span`,{className:`draft-stat-chip draft-score`,children:e.draft_score==null?`–`:e.draft_score.toFixed(1)})}),(0,u.jsx)(`td`,{className:`dn-act`,children:(0,u.jsxs)(`div`,{className:`d-flex gap-1 justify-content-end align-items-center`,children:[(0,u.jsx)(`button`,{className:`btn btn-sm py-0 px-2 ${P.has(e.id)?`btn-warning`:`btn-outline-secondary`}`,onClick:()=>P.has(e.id)?K(e.id):Ye(e.id),title:P.has(e.id)?`Remove from your queue`:`Add to your pre-draft queue`,style:{fontSize:`.8125rem`},children:(0,u.jsx)(`i`,{className:`bi ${P.has(e.id)?`bi-bookmark-check-fill`:`bi-bookmark-plus`}`})}),(0,u.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,onClick:()=>J&&Y(e.id),disabled:!J,title:t?`Position blocked, draft other positions first`:``,style:{fontSize:`.8125rem`},children:t?(0,u.jsx)(`i`,{className:`bi bi-lock-fill`}):`Pick`})]})})]},e.id)})})]})})]})}),(0,u.jsx)(`div`,{className:`col-lg-5`,children:(0,u.jsxs)(`div`,{className:`draft-right-col`,children:[X&&(()=>{let e=v.filter(e=>Be.ids.has(e.id));return(0,u.jsxs)(`div`,{className:`card`,style:{flexShrink:0},children:[(0,u.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,u.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,u.jsxs)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${N===`queue`?` active`:``}`,onClick:()=>ze(`queue`),style:{fontSize:`.8125rem`,padding:`2px 10px`},children:[(0,u.jsx)(`i`,{className:`bi bi-bookmark-star me-1`}),`Queue`,M.length>0?` (${M.length})`:``]}),(0,u.jsxs)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${N===`wishlist`?` active`:``}`,onClick:()=>ze(`wishlist`),style:{fontSize:`.8125rem`,padding:`2px 10px`},children:[(0,u.jsx)(`i`,{className:`bi bi-star me-1`}),`Wishlist`,e.length>0?` (${e.length})`:``]})]}),N===`queue`&&M.length>0&&(0,u.jsx)(`span`,{className:`badge`,style:{background:`#1e1d21`,color:`var(--kl-text-primary)`,fontSize:`.8125rem`},children:`auto-pick order`})]}),(0,u.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,maxHeight:240},children:N===`queue`?M.length===0?(0,u.jsxs)(`div`,{className:`text-center`,style:{color:`var(--kl-text-primary)`,fontSize:`.8125rem`,padding:`14px 16px`,lineHeight:1.5},children:[`Tap `,(0,u.jsx)(`i`,{className:`bi bi-bookmark-plus`}),` on a player to queue him. If your timer runs out, the top of your queue is drafted.`]}):(0,u.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,u.jsx)(`tbody`,{children:M.map((e,t)=>(0,u.jsxs)(`tr`,{children:[(0,u.jsx)(`td`,{style:{color:`var(--kl-text-primary)`,width:22},children:t+1}),(0,u.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,u.jsxs)(`td`,{className:`text-end`,style:{width:96,whiteSpace:`nowrap`},children:[(0,u.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,disabled:!J,onClick:()=>J&&Y(e.player_id),style:{fontSize:`.8125rem`},children:`Pick`}),(0,u.jsx)(`button`,{className:`btn btn-link p-0 ms-2`,onClick:()=>K(e.player_id),title:`Remove`,style:{color:`#f85149`,fontSize:`.8125rem`},children:(0,u.jsx)(`i`,{className:`bi bi-x-lg`})})]})]},e.player_id))})}):e.length===0?(0,u.jsx)(`div`,{className:`text-center`,style:{color:`var(--kl-text-primary)`,fontSize:`.8125rem`,padding:`14px 16px`,lineHeight:1.5},children:`Star a player anywhere on the site and he shows here while he is still available.`}):(0,u.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,u.jsx)(`tbody`,{children:e.map(e=>(0,u.jsxs)(`tr`,{children:[(0,u.jsx)(`td`,{className:`player-name`,children:e.name}),(0,u.jsx)(`td`,{style:{width:48},children:e.position&&(0,u.jsx)(`span`,{className:`draft-pos-chip ${d(e.position)}`,children:e.position.split(`/`)[0]})}),(0,u.jsxs)(`td`,{className:`text-end`,style:{width:110,whiteSpace:`nowrap`},children:[(0,u.jsx)(`button`,{className:`btn btn-sm py-0 px-2 ${P.has(e.id)?`btn-warning`:`btn-outline-secondary`}`,onClick:()=>P.has(e.id)?K(e.id):Ye(e.id),title:P.has(e.id)?`Queued`:`Add to queue`,style:{fontSize:`.8125rem`},children:(0,u.jsx)(`i`,{className:`bi ${P.has(e.id)?`bi-bookmark-check-fill`:`bi-bookmark-plus`}`})}),(0,u.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2 ms-1`,disabled:!J,onClick:()=>J&&Y(e.id),style:{fontSize:`.8125rem`},children:`Pick`})]})]},e.id))})})})]})})(),(0,u.jsxs)(`div`,{className:`card`,style:{flex:3},children:[(0,u.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,u.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,u.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-clock-history me-2`,style:{color:`var(--kl-text-primary)`}}),`Pick History`]}),X&&(0,u.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,u.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${Ne===`all`?` active`:``}`,onClick:()=>Pe(`all`),style:{fontSize:`.8125rem`,padding:`2px 8px`},children:`All`}),(0,u.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${Ne===`mine`?` active`:``}`,onClick:()=>Pe(`mine`),style:{fontSize:`.8125rem`,padding:`2px 8px`},children:`Mine`})]})]}),(0,u.jsxs)(`span`,{className:`badge`,style:{background:`#1e1d21`,color:`var(--kl-text-primary)`,fontSize:`.8125rem`},children:[g.picks_made,`/`,g.total_picks]})]}),(0,u.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(0,u.jsxs)(`table`,{className:`table table-sm mb-0 dn-hist-tbl`,children:[(0,u.jsx)(`thead`,{className:`sticky-top`,children:(0,u.jsxs)(`tr`,{children:[(0,u.jsx)(`th`,{children:`#`}),(0,u.jsx)(`th`,{children:`Team`}),(0,u.jsx)(`th`,{children:`Player`}),(0,u.jsx)(`th`,{children:`Pos`}),(0,u.jsx)(`th`,{children:`Rtg`}),(0,u.jsx)(`th`,{children:`Pot`})]})}),(0,u.jsx)(`tbody`,{children:Tt.map(e=>(0,u.jsxs)(`tr`,{className:X&&e.team_id===X.id?`draft-pick-row-mine`:void 0,children:[(0,u.jsx)(`td`,{className:`dn-pickno`,title:`Round ${e.round}`,children:e.pick_number}),(0,u.jsxs)(`td`,{children:[(0,u.jsxs)(`span`,{className:`dn-teamcell`,title:e.team_name,children:[(0,u.jsx)(o,{team:Q(e.team_id),size:24}),(0,u.jsx)(`span`,{className:`dn-teamname`,children:e.team_name})]}),e.via_team_name&&(0,u.jsxs)(`span`,{style:{color:`var(--kl-text-primary)`,fontSize:`.85em`},children:[` via `,e.via_team_name]}),e.label&&(0,u.jsxs)(`span`,{style:{color:`#d29922`,fontSize:`.8em`,fontWeight:600},children:[` `,e.label]})]}),e.is_pass?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`td`,{children:(0,u.jsx)(`span`,{className:`draft-pass-tag`,children:`PASS`})}),(0,u.jsx)(`td`,{}),(0,u.jsx)(`td`,{}),(0,u.jsx)(`td`,{})]}):(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`td`,{className:`player-name`,children:(0,u.jsxs)(`span`,{className:`dn-club`,children:[e.player_afl_team&&n[e.player_afl_team]&&(0,u.jsx)(`img`,{src:n[e.player_afl_team],alt:``,title:e.player_afl_team}),e.player_name,e.is_auto_pick&&(0,u.jsx)(`span`,{className:`draft-auto-tag`,children:` (auto)`})]})}),(0,u.jsx)(`td`,{children:e.player_position&&(0,u.jsx)(`span`,{className:`draft-pos-chip ${d(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,u.jsx)(`td`,{children:(0,u.jsx)(`span`,{className:`rt ${s(e.player_rating??null)}`,children:e.player_rating??`-`})}),(0,u.jsx)(`td`,{children:(0,u.jsx)(`span`,{className:`rt rt-line ${s(e.player_potential??null)}`,children:e.player_potential??`-`})})]})]},e.pick_number))})]})})]}),X&&(0,u.jsxs)(`div`,{className:`card`,style:{flex:2},children:[(0,u.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,u.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-person-badge me-2`,style:{color:`#ececf6`}}),X.name]}),(0,u.jsxs)(`span`,{className:`badge`,style:{background:`#1e1d21`,color:`var(--kl-text-primary)`,fontSize:`.8125rem`},children:[be.length,` players`]})]}),(0,u.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(()=>{let e={DEF:[],MID:[],RUC:[],FWD:[],OTHER:[]};return be.forEach(t=>{let n=(t.player_position||``).split(`/`)[0].toUpperCase();n===`DEF`||n===`MID`||n===`RUC`||n===`FWD`?e[n].push(t):e.OTHER.push(t)}),[`DEF`,`MID`,`RUC`,`FWD`,`OTHER`].map(t=>e[t].length===0?null:(0,u.jsxs)(`div`,{children:[(0,u.jsxs)(`div`,{className:`draft-yt-section ${t===`OTHER`?``:t.toLowerCase()}`,children:[t,` `,e[t].length]}),(0,u.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,u.jsx)(`tbody`,{children:e[t].map(e=>(0,u.jsxs)(`tr`,{children:[(0,u.jsx)(`td`,{style:{color:`var(--kl-text-primary)`,width:30},children:e.pick_number}),(0,u.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,u.jsx)(`td`,{style:{width:50},children:e.player_position&&(0,u.jsx)(`span`,{className:`draft-pos-chip ${d(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,u.jsx)(`td`,{style:{color:`var(--kl-text-primary)`,width:60},children:e.player_afl_team})]},e.pick_number))})})]},t))})()})]}),(0,u.jsxs)(`div`,{className:`card draft-chat-card`,children:[(0,u.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,style:{cursor:`pointer`},onClick:st,children:[(0,u.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,u.jsx)(`i`,{className:`bi bi-chat-dots me-2`,style:{color:`#d29922`}}),`Draft Chat`]}),(0,u.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[Ue>0&&(0,u.jsx)(`span`,{className:`badge`,style:{background:`#f85149`,fontSize:`.8125rem`,borderRadius:8},children:Ue}),(0,u.jsx)(`i`,{className:`bi bi-chevron-down${F?``:` chat-toggle-collapsed`}`,style:{color:`var(--kl-text-primary)`,fontSize:`.8125rem`,transition:`transform .2s`}})]})]}),F&&(0,u.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`},children:[(0,u.jsx)(`div`,{ref:z,id:`chat-messages`,className:`card-body p-0`,style:{overflowY:`auto`,padding:`.5rem !important`,maxHeight:180},children:I.length===0?(0,u.jsx)(`div`,{className:`text-center py-3`,style:{color:`var(--kl-text-primary)`,fontSize:`.8125rem`},children:(0,u.jsx)(`i`,{className:`bi bi-chat-dots`,style:{fontSize:`1.2rem`}})}):I.map((e,t)=>e.is_system?(0,u.jsx)(`div`,{className:`chat-msg-system`,children:e.message},t):(0,u.jsxs)(`div`,{className:`chat-msg`,children:[(0,u.jsx)(`span`,{className:`chat-msg-name`,style:{color:at(e.team_name)},children:e.team_name}),(0,u.jsx)(`span`,{className:`chat-msg-text`,children:e.message})]},t))}),(0,u.jsxs)(`div`,{style:{borderTop:`1px solid rgba(220,218,231,.12)`,padding:`8px 12px`,display:`flex`,gap:6},children:[(0,u.jsx)(`input`,{type:`text`,className:`draft-filter-input flex-grow-1`,placeholder:`Say something...`,maxLength:500,value:R,onChange:e=>He(e.target.value),onKeyDown:e=>{e.key===`Enter`&&(e.preventDefault(),ot())}}),(0,u.jsx)(`button`,{className:`btn btn-sm btn-primary`,onClick:ot,style:{padding:`4px 12px`,whiteSpace:`nowrap`},children:(0,u.jsx)(`i`,{className:`bi bi-send`})})]})]})]})]})})]}),D!=null&&Ct&&(()=>{let e=Ct,t=e.afl_team?n[e.afl_team]:void 0;return(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`div`,{onClick:()=>O(null),className:`dn-confirm-back`}),(0,u.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,"aria-label":`Confirm pick`,className:`dn-confirm`,children:[(0,u.jsxs)(`div`,{className:`pmod-face`,style:{...ie(e.afl_team),"--logo":t?`url("${t}")`:`none`,"--pc":`var(--pos-${(e.position||`MID`).split(`/`)[0].toLowerCase()})`,"--pc2":`var(--pos-${((e.position||`MID`).split(`/`)[1]||(e.position||`MID`).split(`/`)[0]).toLowerCase()})`},children:[(0,u.jsx)(`div`,{className:`pmod-face-top`,children:(e.position||`MID`).split(`/`).map(t=>(0,u.jsx)(`span`,{className:`pos-badge badge-${t.toLowerCase()}${e.position_expected?` pos-expected`:``}`,children:t},t))}),(0,u.jsxs)(`div`,{className:`pmod-face-id`,children:[t&&(0,u.jsx)(`img`,{className:`pmod-crest`,src:t,alt:``}),(0,u.jsxs)(`div`,{style:{minWidth:0},children:[(0,u.jsx)(`div`,{className:`pmod-first`,children:e.name.split(` `)[0]}),(0,u.jsx)(`div`,{className:`pmod-sur`,children:e.name.split(` `).slice(1).join(` `)||e.name})]})]}),(0,u.jsxs)(`div`,{className:`pmod-face-meta`,children:[(0,u.jsx)(`span`,{children:e.afl_team}),e.age!=null&&(0,u.jsxs)(`span`,{children:[`Age `,e.age]})]}),(0,u.jsxs)(`div`,{className:`pmod-nums`,style:{gridTemplateColumns:`repeat(3, 1fr)`},children:[(0,u.jsxs)(`div`,{className:`pmod-num`,children:[(0,u.jsx)(`b`,{children:e.sc_avg==null?`-`:Math.round(e.sc_avg)}),(0,u.jsx)(`span`,{children:`Average`})]}),(0,u.jsxs)(`div`,{className:`pmod-num`,children:[(0,u.jsx)(`b`,{children:(0,u.jsx)(`span`,{className:`rt ${s(e.rating)}`,children:e.rating??`-`})}),(0,u.jsx)(`span`,{children:`Rating`})]}),(0,u.jsxs)(`div`,{className:`pmod-num`,children:[(0,u.jsx)(`b`,{children:(0,u.jsx)(`span`,{className:`rt rt-line ${s(e.potential)}`,children:e.potential??`-`})}),(0,u.jsx)(`span`,{children:`Potential`})]})]})]}),(0,u.jsxs)(`div`,{className:`dn-confirm-foot`,children:[(0,u.jsx)(`button`,{type:`button`,className:`kx-btn`,onClick:()=>O(null),children:`Cancel`}),(0,u.jsxs)(`button`,{type:`button`,className:`kx-btn kx-btn-gold`,onClick:rt,children:[`Draft `,e.name.split(` `).slice(-1)[0]]})]})]})]})})(),Fe&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`div`,{onClick:()=>k(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,u.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#151518`,border:`1px solid #2a292f`,borderRadius:12},children:[(0,u.jsxs)(`div`,{style:{borderBottom:`1px solid #2a292f`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,u.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Pass Pick?`}),(0,u.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>k(!1)})]}),(0,u.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,u.jsx)(`div`,{style:{fontSize:`.85rem`,color:`var(--kl-text-primary)`},children:`Are you sure you want to pass on this pick? You won't draft a player this round.`})}),(0,u.jsxs)(`div`,{style:{borderTop:`1px solid #2a292f`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,u.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>k(!1),children:`Cancel`}),(0,u.jsx)(`button`,{type:`button`,className:`btn btn-warning btn-sm flex-fill`,onClick:it,children:`Pass`})]})]})]}),Ie&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`div`,{onClick:()=>A(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,u.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#151518`,border:`1px solid #2a292f`,borderRadius:12},children:[(0,u.jsxs)(`div`,{style:{borderBottom:`1px solid #2a292f`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,u.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`,color:`#f85149`},children:`End Draft Early?`}),(0,u.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>A(!1)})]}),(0,u.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,u.jsxs)(`div`,{style:{fontSize:`.85rem`,color:`var(--kl-text-primary)`},children:[`All remaining picks will be marked as `,(0,u.jsx)(`strong`,{style:{color:`#d29922`},children:`PASS`}),` and the draft will be completed immediately.`]})}),(0,u.jsxs)(`div`,{style:{borderTop:`1px solid #2a292f`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,u.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>A(!1),children:`Cancel`}),(0,u.jsx)(`button`,{type:`button`,className:`btn btn-danger btn-sm flex-fill`,onClick:_t,children:`End Draft`})]})]})]})]})}var p=class extends l.Component{state={error:null};static getDerivedStateFromError(e){return{error:e}}componentDidCatch(e,t){console.error(`Draft room crash:`,e,t)}render(){return this.state.error?(0,u.jsx)(`div`,{className:`card mt-4`,children:(0,u.jsxs)(`div`,{className:`card-body`,children:[(0,u.jsxs)(`h5`,{style:{color:`#f85149`},children:[(0,u.jsx)(`i`,{className:`bi bi-exclamation-triangle me-2`}),`Draft room hit an error`]}),(0,u.jsx)(`p`,{style:{fontSize:`.85rem`,color:`var(--kl-text-primary)`},children:`The draft data still loaded, this is a display glitch, not lost picks. Reload to try again.`}),(0,u.jsxs)(`pre`,{style:{fontSize:`.8125rem`,color:`var(--kl-text-primary)`,whiteSpace:`pre-wrap`,maxHeight:220,overflow:`auto`},children:[this.state.error.message,`
`,this.state.error.stack]}),(0,u.jsx)(`button`,{className:`btn btn-sm btn-outline-primary mt-2`,onClick:()=>window.location.reload(),children:`Reload`})]})}):this.props.children}};function pe(){return(0,u.jsx)(p,{children:(0,u.jsx)(f,{})})}export{pe as DraftRoomPage};