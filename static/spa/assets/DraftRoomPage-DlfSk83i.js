import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";import{l as r,n as i,u as a}from"./chunk-QFMPRPBF-tanTk093.js";import{n as ee}from"./api-C-kTb_mu.js";import{r as te}from"./LeagueContext-B-F7Wq45.js";import{n as ne,t as re}from"./useWishlist-Dx6Xklb3.js";var o=e(t(),1),s=n();function ie(){return(0,s.jsxs)(`div`,{className:`drsk`,children:[(0,s.jsxs)(`div`,{className:`drsk-clock`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-timer`}),(0,s.jsx)(`span`,{className:`kl-skel drsk-onclock`})]}),(0,s.jsxs)(`div`,{className:`drsk-cols`,children:[(0,s.jsxs)(`div`,{className:`drsk-col drsk-col-list`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-filter`}),Array.from({length:14}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-row`},t))]}),(0,s.jsxs)(`div`,{className:`drsk-col drsk-col-board`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-board-head`}),Array.from({length:6}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-board-row`},t))]})]}),(0,s.jsx)(`div`,{className:`drsk-history`,children:Array.from({length:8}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-pick`},t))})]})}var ae=[{key:`sc_average`,label:`SC Avg`},{key:`age_factor`,label:`Longevity`},{key:`positional_scarcity`,label:`Scarcity`},{key:`trajectory`,label:`Trajectory`},{key:`durability`,label:`Durability`},{key:`rating_potential`,label:`Growth`}],oe=[`#deb565`,`#dcd4ab`,`#c26a2f`,`#e07a6c`,`#c9b284`,`#caa965`,`#d68a7e`,`#f0a97a`],se=`
/* === Draft room · Stadium ====================================== */

/* Banner — current pick + timer. Overrides the legacy GitHub-toned
   rules in global style.css. */
.draft-banner {
  background: rgba(26,24,22,.7) !important;
  border: 1px solid rgba(170,144,91,.18) !important;
  border-radius: 14px !important;
  padding: 16px 22px !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 14px !important;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.draft-banner-your-pick {
  border-color: rgba(153,114,45,.55) !important;
  background: linear-gradient(135deg, rgba(153,114,45,.14), rgba(153,114,45,.02)) !important;
  box-shadow: 0 0 32px -10px rgba(153,114,45,.4);
}
.draft-banner-complete {
  border-color: rgba(135,110,59,.5) !important;
  background: linear-gradient(135deg, rgba(135,110,59,.1), transparent) !important;
}
.draft-pick-badge {
  width: 52px !important;
  height: 52px !important;
  border-radius: 12px !important;
  background: rgba(33,31,28,.85) !important;
  border: 1px solid rgba(170,144,91,.3) !important;
  color: #f7f6f5 !important;
  font-size: 1.2rem !important;
  font-weight: 800 !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.02em;
}
.draft-banner-your-pick .draft-pick-badge {
  background: rgba(153,114,45,.18) !important;
  border-color: rgba(153,114,45,.5) !important;
  color: #e6c686 !important;
}
.draft-pick-badge.scheduled { background: rgba(153,114,45,.12) !important; border-color: rgba(153,114,45,.32) !important; color: #deb565 !important; }
.draft-timer {
  font-size: 2.4rem !important;
  font-weight: 900 !important;
  font-family: inherit !important;
  color: #fbfaf9 !important;
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
  font-size: .58rem !important;
  letter-spacing: .16em !important;
  text-transform: uppercase;
  color: #888076 !important;
  font-weight: 700 !important;
  margin-top: 4px !important;
}
.draft-banner-round { font-size: .56rem; color: #888076; letter-spacing: .16em; text-transform: uppercase; font-weight: 800; }
.draft-banner-team { font-size: 1.15rem; font-weight: 800; color: #f7f6f5; letter-spacing: -.005em; }
.draft-your-pick-pill {
  display: inline-flex;
  align-items: center;
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .18em;
  padding: 3px 9px;
  border-radius: 4px;
  background: rgba(153,114,45,.2);
  color: #e6c686;
  border: 1px solid rgba(153,114,45,.5);
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
  background: rgba(26,24,22,.7);
  border: 1px solid rgba(170,144,91,.18);
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
  background: linear-gradient(90deg, rgba(153,114,45,.6) 0%, rgba(174,146,89,.6) 50%, rgba(184,115,61,.6) 100%);
}
.draft-event-countdown {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f7f6f5;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.01em;
  line-height: 1.1;
  margin-top: 4px;
}
.draft-event-countdown.soon { color: #dcd4ab; }
.draft-event-time { font-size: .82rem; color: #b5a99c; }

/* Status pill on page header */
.conn-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cec7a1;
  box-shadow: 0 0 6px rgba(206,199,161,.5);
}
.conn-dot.off { background: #e07a6c; box-shadow: 0 0 6px rgba(224,122,108,.5); }
.draft-header-info { font-size: .78rem; color: #b5a99c; letter-spacing: .02em; }

/* Available players card */
.draft-avail-tbl { width: 100%; font-size: .82rem; }
.draft-avail-tbl thead th {
  font-size: .58rem !important;
  font-weight: 800 !important;
  letter-spacing: .14em !important;
  color: #888076 !important;
  background: rgba(20,18,17,.7) !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid rgba(170,144,91,.18) !important;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 2;
}
.draft-avail-tbl tbody td {
  padding: 8px 12px;
  font-size: .82rem;
  border-bottom: 1px solid rgba(170,144,91,.06);
  color: #eae7e4;
  vertical-align: middle;
}
.draft-avail-tbl tbody tr { transition: background .14s; }
.draft-avail-tbl tbody tr:hover { background: rgba(153,114,45,.06); }
.draft-avail-tbl tbody tr:hover .player-name { color: #e6c686; }
.draft-avail-tbl .player-name { font-weight: 600; color: #f7f6f5; white-space: nowrap; }
.draft-avail-tbl .stat-cell { font-weight: 700; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; text-align: right; }
.draft-avail-tbl tbody tr.blocked { opacity: .45; }

/* Sortable headers */
.sortable-th { cursor: pointer; user-select: none; white-space: nowrap; transition: color .14s; }
.sortable-th:hover { color: #c4b79d !important; }
.sortable-th .sort-icon { display: inline-block; margin-left: 4px; font-size: .55rem; opacity: .25; transition: opacity .14s, color .14s; }
.sortable-th.active-sort { color: #eae7e4 !important; }
.sortable-th.active-sort .sort-icon { opacity: 1; color: #deb565; }

/* Position chips — match Gameday DEF/MID/RUC/FWD palette */
.draft-pos-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 22px; border-radius: 5px;
  font-size: .56rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  background: rgba(170,144,91,.1); border: 1px solid rgba(170,144,91,.18); color: #c4b79d;
}
.draft-pos-chip.def { background: rgba(143,111,56,.14); color: #caa965; border-color: rgba(143,111,56,.3); }
.draft-pos-chip.mid { background: rgba(153,114,45,.14); color: #deb565; border-color: rgba(153,114,45,.3); }
.draft-pos-chip.ruc { background: rgba(174,146,89,.14); color: #c9b284; border-color: rgba(174,146,89,.3); }
.draft-pos-chip.fwd { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.3); }

/* Rating / potential / draft-score numeric chips */
.draft-stat-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 22px; padding: 0 7px; border-radius: 5px;
  font-size: .74rem; font-weight: 800; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
  background: rgba(170,144,91,.1); border: 1px solid rgba(170,144,91,.18); color: #c4b79d;
}
.draft-stat-chip.tier-elite { background: rgba(194,106,47,.2); color: #f0a97a; border-color: rgba(194,106,47,.45); box-shadow: 0 0 10px -2px rgba(194,106,47,.3); }
.draft-stat-chip.tier-good { background: rgba(153,114,45,.16); color: #deb565; border-color: rgba(153,114,45,.35); }
.draft-stat-chip.tier-ok { background: rgba(174,146,89,.12); color: #c9b284; border-color: rgba(174,146,89,.3); }
.draft-stat-chip.tier-low { background: rgba(184,90,74,.1); color: #d68a7e; border-color: rgba(184,90,74,.25); }
.draft-stat-chip.tier-empty { color: #746d64; background: transparent; border-color: transparent; }
.draft-stat-chip.draft-score { background: rgba(153,114,45,.18); color: #e6c686; border-color: rgba(153,114,45,.4); }

/* Position-need chips (sit above filter row) */
.draft-need-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .66rem; padding: 3px 9px; border-radius: 6px;
  font-weight: 700; letter-spacing: .04em;
  background: rgba(170,144,91,.1); border: 1px solid rgba(170,144,91,.18); color: #c4b79d;
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
}
.draft-need-chip.met { background: rgba(135,110,59,.12); color: #dcd4ab; border-color: rgba(135,110,59,.3); }
.draft-need-chip.short { background: rgba(194,106,47,.12); color: #f0a97a; border-color: rgba(194,106,47,.3); }
.draft-need-chip.blocked { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.36); }
.draft-need-chip.north { background: rgba(153,114,45,.12); color: #deb565; border-color: rgba(153,114,45,.32); }

/* Filter row */
.draft-filter-input, .draft-filter-select {
  background: rgba(26,24,22,.55) !important;
  border: 1px solid rgba(170,144,91,.2) !important;
  color: #eae7e4 !important;
  border-radius: 8px !important;
  padding: 7px 12px !important;
  font-size: .78rem !important;
  height: auto !important;
}
.draft-filter-input:focus, .draft-filter-select:focus { border-color: rgba(153,114,45,.55) !important; outline: 0 !important; box-shadow: 0 0 0 2px rgba(153,114,45,.15) !important; }
.draft-filter-input::placeholder { color: #888076; }

/* Values panel (weight sliders) */
.draft-values-panel {
  background: rgba(20,18,17,.6);
  border: 1px solid rgba(170,144,91,.16);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.draft-values-row { display: flex; align-items: center; gap: 12px; margin-bottom: 9px; }
.draft-values-row:last-of-type { margin-bottom: 4px; }
.draft-values-label { font-size: .68rem; color: #b5a99c; font-weight: 700; letter-spacing: .04em; width: 68px; flex-shrink: 0; }
.draft-values-value { font-size: .72rem; color: #deb565; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; min-width: 36px; text-align: right; font-weight: 700; }
.draft-values-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(170,144,91,.12); }
.draft-values-foot-meta { font-size: .68rem; color: #888076; }
.draft-values-foot-meta .custom { color: #dcd4ab; font-weight: 700; }

input[type="range"].draft-slider {
  appearance: none;
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: rgba(170,144,91,.2);
  border-radius: 2px;
  outline: none;
}
input[type="range"].draft-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #99722d;
  border: 2px solid #f7f6f5;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.4);
}
input[type="range"].draft-slider::-moz-range-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #99722d;
  border: 2px solid #f7f6f5;
  cursor: pointer;
}

/* Right column — pick history / your team / chat cards */
.draft-right-col { display: flex; flex-direction: column; max-height: calc(100vh - 160px); gap: 14px; }
.draft-right-col > .card {
  flex-shrink: 1;
  min-height: 180px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(26,24,22,.7) !important;
  border: 1px solid rgba(170,144,91,.18) !important;
  border-radius: 12px !important;
}
.draft-right-col > .card > .card-body { overflow-y: auto; flex: 1; min-height: 0; }
.draft-right-col .card-header {
  background: rgba(33,31,28,.55) !important;
  border-bottom: 1px solid rgba(170,144,91,.12) !important;
  padding: 11px 14px !important;
  color: #eae7e4;
}
.draft-right-col .card-header h5 { color: #f7f6f5; font-size: .88rem; font-weight: 800; letter-spacing: -.005em; }
.draft-right-col .card-header .badge {
  background: rgba(170,144,91,.16) !important;
  color: #c4b79d !important;
  font-size: .66rem !important;
  font-weight: 700 !important;
  padding: 3px 8px !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
}

/* Tables inside right-col cards */
.draft-right-col table { color: #eae7e4; margin: 0; }
.draft-right-col table thead th {
  font-size: .56rem !important;
  font-weight: 800 !important;
  letter-spacing: .14em !important;
  color: #888076 !important;
  background: rgba(20,18,17,.75) !important;
  padding: 8px 10px !important;
  border-bottom: 1px solid rgba(170,144,91,.18) !important;
  text-transform: uppercase;
}
.draft-right-col table tbody td {
  padding: 6px 10px !important;
  border-bottom: 1px solid rgba(170,144,91,.06) !important;
  font-size: .76rem;
  color: #eae7e4;
  vertical-align: middle;
}
.draft-right-col table tbody tr { transition: background .14s; }
.draft-right-col table tbody tr:hover { background: rgba(153,114,45,.05); }
.draft-pick-row-mine td { background: rgba(153,114,45,.08); color: #e6c686 !important; }
.draft-pick-row-mine .player-name { color: #e6c686 !important; }
.draft-auto-tag { color: #888076; font-size: .62rem; letter-spacing: .02em; }
.draft-pass-tag { color: #f0a97a; font-weight: 800; font-size: .68rem; letter-spacing: .12em; }

/* Your-team grouping section */
.draft-yt-section {
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #888076;
  background: rgba(20,18,17,.6);
  padding: 6px 12px;
  border-left: 2px solid rgba(170,144,91,.3);
}
.draft-yt-section.def { color: #caa965; border-left-color: rgba(143,111,56,.5); }
.draft-yt-section.mid { color: #deb565; border-left-color: rgba(153,114,45,.45); }
.draft-yt-section.ruc { color: #c9b284; border-left-color: rgba(174,146,89,.5); }
.draft-yt-section.fwd { color: #e07a6c; border-left-color: rgba(184,90,74,.45); }

/* Chat — wider re-skin */
.draft-chat-card { flex-shrink: 0; flex-grow: 0; min-height: auto !important; }
.draft-chat-card #chat-messages { max-height: 180px; }
.chat-msg { padding: 5px 12px; font-size: .76rem; border-bottom: 1px solid rgba(170,144,91,.06); }
.chat-msg:last-child { border-bottom: none; }
.chat-msg-name { font-weight: 800; font-size: .68rem; margin-right: 6px; letter-spacing: .02em; }
.chat-msg-text { color: #eae7e4; word-break: break-word; }
.chat-msg-system { text-align: center; font-size: .66rem; color: #888076; font-style: italic; padding: 4px 12px; }
.chat-toggle-collapsed { transform: rotate(-90deg); }

/* Mobile */
@media (max-width: 991.98px) {
  .draft-banner { flex-direction: column; gap: 10px; text-align: center; padding: 14px !important; }
  .draft-banner .draft-pick-badge { width: 40px !important; height: 40px !important; font-size: .9rem !important; }
  .draft-timer { font-size: 1.7rem !important; }
  .draft-event { flex-direction: column; align-items: stretch; text-align: center; }
  .draft-avail-tbl th:nth-child(3), .draft-avail-tbl td:nth-child(3) { display: none; }
  .draft-avail-tbl th:nth-child(6), .draft-avail-tbl td:nth-child(6) { display: none; }
  .draft-right-col { max-height: none; padding-bottom: 80px; }
  .col-lg-5 > .card, .col-lg-7 > .card { max-height: 50vh !important; }
  .draft-chat-card { max-height: none !important; }
}
`;function ce(e){if(e<=0)return`Starting soon...`;let t=Math.floor(e/1e3),n=Math.floor(t/86400),r=Math.floor(t%86400/3600),i=Math.floor(t%3600/60),a=t%60;return n>0?`${n}d ${r}h ${i}m`:r>0?`${r}h ${i}m ${a}s`:i>0?`${i}m ${a}s`:`${a}s`}function c(e){return e?e.split(`/`)[0].toLowerCase():`mid`}function le(e){return e==null?`tier-empty`:e>=80?`tier-elite`:e>=70?`tier-good`:e>=60?`tier-ok`:`tier-low`}function ue(e){return e==null?`tier-empty`:e>=80?`tier-elite`:e>=70?`tier-good`:e>=60?`tier-ok`:`tier-low`}function l(){let{leagueId:e}=a(),t=te(),n=r(),[l,u]=(0,o.useState)(null),[d,de]=(0,o.useState)(null),[fe,pe]=(0,o.useState)(!0),[f,p]=(0,o.useState)(null),[m,me]=(0,o.useState)([]),[h,he]=(0,o.useState)(null),[ge,_e]=(0,o.useState)([]),[g,ve]=(0,o.useState)(``),[_,ye]=(0,o.useState)(``),[v,be]=(0,o.useState)(``),[y,xe]=(0,o.useState)(``),[b,Se]=(0,o.useState)(`draft_score`),[x,Ce]=(0,o.useState)(`desc`),[S,C]=(0,o.useState)({}),[we,Te]=(0,o.useState)(!1),[Ee,De]=(0,o.useState)(!1),[w,Oe]=(0,o.useState)(`all`),[T,E]=(0,o.useState)(null),[ke,D]=(0,o.useState)(!1),[Ae,O]=(0,o.useState)(!1),[k,je]=(0,o.useState)(!1),[A,Me]=(0,o.useState)([]),[j,Ne]=(0,o.useState)(`queue`),Pe=re(e),M=(0,o.useMemo)(()=>new Set(A.map(e=>e.player_id)),[A]),[N,Fe]=(0,o.useState)(()=>typeof window<`u`&&window.innerWidth>=992),[P,F]=(0,o.useState)([]),[I,Ie]=(0,o.useState)(``),[Le,Re]=(0,o.useState)(0),L=(0,o.useRef)(null),R=(0,o.useRef)({}),[ze,z]=(0,o.useState)(``),[Be,Ve]=(0,o.useState)(``),B=(0,o.useRef)(null);(0,o.useEffect)(()=>{pe(!0),ee(`/leagues/${e}/draft?format=json`).then(e=>{if(`empty_state`in e){de(e);return}u(e),p(e.state),C(e.user_weights),De(e.has_custom_weights),e.session.scheduled_start&&z(e.session.scheduled_start.slice(0,16))}).catch(()=>{}).finally(()=>pe(!1))},[e]),(0,o.useEffect)(()=>{B.current&&window.clearInterval(B.current);let e=l?.session.scheduled_start;if(!e||f?.status!==`scheduled`){Ve(e?``:`No time set`);return}let t=()=>{Ve(ce(new Date(e).getTime()-Date.now()))};return t(),B.current=window.setInterval(t,1e3),()=>{B.current&&window.clearInterval(B.current)}},[l?.session.scheduled_start,f?.status]);let V=(0,o.useCallback)(()=>{l?.user_team&&fetch(`/leagues/${e}/draft/api/position_needs`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>{e.error||he(e)}).catch(()=>{})},[e,l?.user_team]),H=(0,o.useCallback)(()=>{l?.user_team&&fetch(`/leagues/${e}/draft/api/team_picks/${l.user_team.id}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>_e(Array.isArray(e)?e:[])).catch(()=>{})},[e,l?.user_team]),U=(0,o.useCallback)(()=>{let t=ae.map(e=>`w_${e.key}=${S[e.key]??.2}`).join(`&`),n=y||v===`new`?800:200,r=new URLSearchParams;r.set(`q`,g),_&&r.set(`pos`,_),r.set(`limit`,String(n)),fetch(`/leagues/${e}/draft/api/available?${r.toString()}&${t}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>me(Array.isArray(e)?e:[])).catch(()=>me([]))},[e,g,_,y,v===`new`,S]),W=(0,o.useCallback)(()=>{l?.user_team&&fetch(`/leagues/${e}/draft/api/queue`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>Me(Array.isArray(e)?e:[])).catch(()=>{})},[e,l?.user_team]),He=(0,o.useCallback)(t=>{fetch(`/leagues/${e}/draft/api/queue`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({player_id:t}),credentials:`same-origin`}).then(()=>W()).catch(()=>{})},[e,W]),G=(0,o.useCallback)(t=>{fetch(`/leagues/${e}/draft/api/queue`,{method:`DELETE`,headers:{"Content-Type":`application/json`},body:JSON.stringify({player_id:t}),credentials:`same-origin`}).then(()=>W()).catch(()=>{})},[e,W]);(0,o.useEffect)(()=>{l&&U()},[l,U]),(0,o.useEffect)(()=>{l&&(V(),H(),W())},[l,V,H,W]),(0,o.useEffect)(()=>{l&&fetch(`/leagues/${e}/draft/api/chat_history`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>F(Array.isArray(e)?e:[])).catch(()=>{})},[e,l]),(0,o.useEffect)(()=>{L.current&&(L.current.scrollTop=L.current.scrollHeight)},[P,N]);let{socket:K,state:Ue}=ne({namespace:`/draft`,onConnect:t=>t.emit(`join_draft`,{league_id:Number(e)}),events:{draft_state:e=>{p(e),V(),H(),U(),W()},pick_made:e=>{let t=e;p(e=>e&&{...e,pick_history:[t,...e.pick_history],picks_made:e.picks_made+1,picked_player_ids:t.player_id?[...e.picked_player_ids,t.player_id]:e.picked_player_ids}),F(e=>[...e,{team_name:t.team_name,message:t.is_pass?`${t.team_name} passed`:`${t.team_name} drafted ${t.player_name}`,is_system:!0}]),V(),U(),t.team_id===l?.user_team?.id&&H()},timer_tick:e=>{let{remaining:t}=e;p(e=>e&&{...e,timer_remaining:t})},draft_completed:e=>{p({...e,status:`completed`})},draft_chat_msg:e=>{let t=e;F(e=>[...e,t]),N||Re(e=>e+1)},schedule_updated:e=>{let{scheduled_start:t}=e;u(e=>e&&{...e,session:{...e.session,scheduled_start:t}}),t&&z(t.slice(0,16))},error:e=>alert(e.message)}}),We=(0,o.useMemo)(()=>{let e=m.filter(e=>!(f&&e.id!=null&&f.picked_player_ids.includes(e.id)));v===`new`?e=e.filter(e=>!!e.is_new):v&&(e=e.filter(e=>e.age==null?!1:v===`30+`?e.age>=30:v===`25-30`?e.age>=25&&e.age<=30:e.age<parseInt(v))),y&&(e=e.filter(e=>e.afl_team===y));let t=x===`asc`?1:-1;return e.slice().sort((e,n)=>{let r=e[b],i=n[b];return r==null&&i==null?0:r==null?1:i==null?-1:typeof r==`string`&&typeof i==`string`?t*r.localeCompare(i):t*(r-i)}).slice(0,100)},[m,v,y,b,x,f]),Ge=(0,o.useMemo)(()=>{let e=new Set;return m.forEach(t=>{t.afl_team&&e.add(t.afl_team)}),[...e].sort()},[m]),Ke=e=>{b===e?Ce(e=>e===`desc`?`asc`:`desc`):(Se(e),Ce([`name`,`position`,`afl_team`].includes(e)?`asc`:`desc`))},qe=e=>b===e?x===`desc`?`bi-chevron-down`:`bi-chevron-up`:`bi-chevron-expand`,Je=!!(l?.user_team&&f?.current_team_id===l.user_team.id),q=f?.status===`in_progress`&&(Je||l?.is_commissioner&&k);function Ye(e){return!h||!h.blocked_positions.length||!e?!1:e.split(`/`).map(e=>e.trim().toUpperCase()).every(e=>h.blocked_positions.includes(e))}function J(e){if(!K?.connected){alert(`Not connected — refresh the page.`);return}E(e)}function Xe(){T==null||!K||(K.emit(`make_pick`,{league_id:Number(e),player_id:T}),E(null))}function Ze(){K?.emit(`pass_pick`,{league_id:Number(e)}),D(!1)}function Qe(e){if(!R.current[e]){let t=Object.keys(R.current).length;R.current[e]=oe[t%oe.length]}return R.current[e]}function $e(){!I.trim()||!K||(K.emit(`draft_chat`,{league_id:Number(e),message:I.trim()}),Ie(``))}function et(){let e=!N;Fe(e),e&&Re(0)}function tt(e,t){C(n=>({...n,[e]:t}))}function nt(){U()}async function rt(){try{let t=await(await fetch(`/leagues/${e}/draft/api/save_weights`,{method:`POST`,credentials:`same-origin`,headers:{"Content-Type":`application/json`},body:JSON.stringify(S)})).json();t.status===`ok`&&(t.weights&&C(t.weights),De(!0),U())}catch{}}function it(){K?.emit(`update_schedule`,{league_id:Number(e),scheduled_start:ze||null})}function at(){K?.emit(`start_draft`,{league_id:Number(e)})}function ot(){confirm(`Pause the draft? All timers will stop.`)&&K?.emit(`pause_draft`,{league_id:Number(e)})}function st(){K?.emit(`resume_draft`,{league_id:Number(e)})}function ct(){confirm(`Undo the last pick?`)&&K?.emit(`undo_pick`,{league_id:Number(e)})}function lt(){if(!confirm(`Are you sure you want to restart the draft?

This will DELETE the current draft session, remove all drafted players from rosters, and take you to settings where you can make changes before re-drafting.

This cannot be undone.`))return;let t=new FormData;t.set(`action`,`restart_draft`),fetch(`/leagues/${e}/draft/setup`,{method:`POST`,body:t,credentials:`same-origin`}).then(()=>n(`/leagues/${e}/settings`))}async function ut(){let t=new FormData;try{await fetch(`/leagues/${e}/draft/api/end`,{method:`POST`,body:t,credentials:`same-origin`}),O(!1)}catch{}}if(fe)return(0,s.jsx)(ie,{});if(d)return(0,s.jsx)(`div`,{children:(0,s.jsxs)(`div`,{className:`empty-state`,children:[(0,s.jsx)(`div`,{className:`empty-icon`,children:(0,s.jsx)(`i`,{className:`bi bi-list-check`})}),(0,s.jsx)(`h4`,{children:`No draft scheduled yet`}),(0,s.jsx)(`p`,{children:d.is_commissioner?`Set up a draft session to get everyone in the room. While you wait, you can plan your picks in the player pool.`:`Your commissioner hasn't scheduled the next draft. You can still browse the player pool and plan your picks.`}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-center gap-2 flex-wrap`,children:[(0,s.jsxs)(i,{to:`/leagues/${e}/player-pool`,className:`btn btn-primary btn-sm`,children:[(0,s.jsx)(`i`,{className:`bi bi-search me-1`}),`Browse player pool`]}),d.is_commissioner&&(0,s.jsxs)(i,{to:`/leagues/${e}/draft/setup`,className:`btn btn-outline-primary btn-sm`,children:[(0,s.jsx)(`i`,{className:`bi bi-calendar-plus me-1`}),`Set up draft`]}),(0,s.jsxs)(i,{to:`/leagues/${e}/player-ratings`,className:`btn btn-outline-secondary btn-sm`,children:[(0,s.jsx)(`i`,{className:`bi bi-star me-1`}),`Player ratings`]})]})]})});if(!l||!f)return(0,s.jsx)(`p`,{className:`text-danger`,children:`Failed to load draft room`});let{league:dt,user_team:Y,is_commissioner:ft,can_restart:pt,session:X}=l,Z=X.scheduled_start?new Date(X.scheduled_start):null,mt=Z?Z.toLocaleDateString(`en-AU`,{weekday:`short`,day:`numeric`,month:`short`})+`, `+Z.toLocaleTimeString(`en-AU`,{hour:`numeric`,minute:`2-digit`}):``,Q=T==null?null:m.find(e=>e.id===T),ht=Je&&f.status===`in_progress`,$=f.status===`completed`,gt=w===`mine`&&Y?f.pick_history.filter(e=>e.team_name===Y.name):f.pick_history;return(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`style`,{children:se}),(0,s.jsxs)(`div`,{className:`page-header`,children:[(0,s.jsxs)(`div`,{className:`page-breadcrumb`,children:[(0,s.jsx)(i,{to:`/leagues/${e}`,children:dt.name}),` / Draft Room`]}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-start flex-wrap gap-2`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h2`,{className:`mb-0`,children:`Live Draft`}),(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3 mt-1`,children:[(0,s.jsx)(`span`,{className:`conn-dot${Ue===`connected`?``:` off`}`,title:Ue===`connected`?`Connected`:`Disconnected`}),(0,s.jsx)(`span`,{className:`status-pill status-${f.status.replace(`_`,`-`)}`,children:f.status}),(0,s.jsxs)(`span`,{className:`draft-header-info`,children:[(f.draft_type||dt.draft_type)===`snake`?`Snake`:`Same order every round`,` · `,X.pick_timer_secs?`${X.pick_timer_secs}s timer`:`No timer`]})]})]}),ft&&(0,s.jsxs)(`div`,{className:`d-flex gap-2 align-items-center flex-wrap`,children:[(0,s.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm${k?` active`:``}`,onClick:()=>je(e=>!e),style:{fontSize:`.7rem`},title:`Pick on behalf of other teams`,children:[(0,s.jsx)(`i`,{className:`bi bi-shield${k?`-fill-check`:``} me-1`}),k?`Override ON`:`Override`]}),f.status===`scheduled`&&(0,s.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:at,children:[(0,s.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Start Draft`]}),f.status===`in_progress`&&(0,s.jsxs)(`button`,{className:`btn btn-outline-secondary btn-sm`,onClick:ot,children:[(0,s.jsx)(`i`,{className:`bi bi-pause-fill me-1`}),`Pause`]}),f.status===`paused`&&(0,s.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:st,children:[(0,s.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Resume`]}),f.picks_made>0&&(f.status===`in_progress`||f.status===`paused`)&&(0,s.jsxs)(`button`,{className:`btn btn-outline-info btn-sm`,onClick:ct,style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Undo`]}),(f.status===`in_progress`||f.status===`paused`)&&(0,s.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:()=>O(!0),style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-stop-fill me-1`}),`End Draft`]}),pt&&(0,s.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:lt,style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Restart`]})]})]})]}),f.status===`scheduled`?(0,s.jsxs)(`div`,{className:`draft-event`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,s.jsx)(`div`,{className:`draft-pick-badge scheduled`,children:(0,s.jsx)(`i`,{className:`bi bi-hourglass-split`})}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`div`,{className:`draft-banner-round`,children:`Draft Starts In`}),(0,s.jsx)(`div`,{className:`draft-event-countdown${Be===`Starting soon...`?` soon`:``}`,children:Be}),mt&&(0,s.jsx)(`div`,{className:`draft-event-time`,children:mt})]})]}),ft&&(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,s.jsx)(`input`,{type:`datetime-local`,className:`draft-filter-input`,value:ze,onChange:e=>z(e.target.value),style:{width:`auto`}}),(0,s.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm`,onClick:it,style:{fontSize:`.7rem`,whiteSpace:`nowrap`},children:[(0,s.jsx)(`i`,{className:`bi bi-clock me-1`}),`Set Time`]})]})]}):(0,s.jsxs)(`div`,{className:`draft-banner${ht?` draft-banner-your-pick`:``}${$?` draft-banner-complete`:``}`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,s.jsx)(`div`,{className:`draft-pick-badge`,children:(0,s.jsx)(`span`,{children:f.current_pick||`-`})}),(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`draft-banner-round`,children:[`Round `,f.current_round||`-`]}),(0,s.jsxs)(`div`,{className:`draft-banner-team`,children:[$?`Draft Complete`:f.current_team_name||`TBD`,!$&&f.current_via_team_name&&(0,s.jsxs)(`span`,{style:{fontSize:`.7em`,fontWeight:600,color:`#b5a99c`,marginLeft:8},children:[`via `,f.current_via_team_name]}),!$&&f.current_label&&(0,s.jsx)(`span`,{style:{fontSize:`.6em`,fontWeight:700,color:`#d26822`,marginLeft:8},children:f.current_label}),ht&&(0,s.jsx)(`span`,{className:`draft-your-pick-pill`,children:`Your Pick`})]})]})]}),X.pick_timer_secs>0?(0,s.jsxs)(`div`,{className:`draft-timer-block`,children:[(0,s.jsx)(`span`,{className:`draft-timer${(f.timer_remaining??0)<=10&&f.timer_remaining!=null?` timer-urgent`:``}`,children:$?`-`:f.timer_remaining??X.pick_timer_secs}),(0,s.jsx)(`span`,{className:`draft-timer-label`,children:`seconds`})]}):(0,s.jsx)(`div`,{className:`draft-timer-block`,children:(0,s.jsxs)(`span`,{className:`draft-timer-label`,children:[(0,s.jsx)(`i`,{className:`bi bi-infinity me-1`}),`Untimed`]})})]}),(0,s.jsxs)(`div`,{className:`row g-3`,children:[(0,s.jsx)(`div`,{className:`col-lg-7`,children:(0,s.jsxs)(`div`,{className:`card`,style:{display:`flex`,flexDirection:`column`},children:[(0,s.jsxs)(`div`,{className:`card-header`,children:[(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center mb-2`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-people me-2`,style:{color:`#a39586`}}),`Available Players`]}),(0,s.jsxs)(`div`,{className:`d-flex gap-1 align-items-center`,children:[f.status===`in_progress`&&(0,s.jsxs)(`button`,{className:`btn btn-outline-warning py-0 px-2`,onClick:()=>D(!0),disabled:!q,style:{fontSize:`.7rem`},title:q?`Pass on this pick`:`You can pass when it’s your turn`,children:[(0,s.jsx)(`i`,{className:`bi bi-skip-forward me-1`}),`Pass`]}),(0,s.jsxs)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,type:`button`,onClick:()=>Te(e=>!e),style:{fontSize:`.7rem`},title:`Adjust your draft value weights`,children:[(0,s.jsx)(`i`,{className:`bi bi-sliders me-1`}),`Values`]})]})]}),we&&(0,s.jsxs)(`div`,{className:`draft-values-panel`,children:[ae.map(({key:e,label:t})=>(0,s.jsxs)(`div`,{className:`draft-values-row`,children:[(0,s.jsx)(`span`,{className:`draft-values-label`,children:t}),(0,s.jsx)(`input`,{type:`range`,className:`draft-slider`,min:0,max:1,step:.01,value:S[e]??.2,onChange:t=>tt(e,parseFloat(t.target.value))}),(0,s.jsxs)(`span`,{className:`draft-values-value`,children:[Math.round((S[e]??.2)*100),`%`]})]},e)),(0,s.jsxs)(`div`,{className:`draft-values-foot`,children:[(0,s.jsx)(`span`,{className:`draft-values-foot-meta`,children:Ee?(0,s.jsx)(`span`,{className:`custom`,children:`Custom`}):`League defaults`}),(0,s.jsxs)(`div`,{className:`d-flex gap-1`,children:[(0,s.jsx)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,onClick:nt,style:{fontSize:`.7rem`},children:`Apply`}),(0,s.jsx)(`button`,{className:`btn btn-primary py-0 px-2`,onClick:rt,style:{fontSize:`.7rem`},children:`Save`})]})]})]}),h&&Y&&(0,s.jsxs)(`div`,{className:`d-flex gap-2 mb-2 flex-wrap`,children:[[`DEF`,`MID`,`FWD`,`RUC`].map(e=>{let t=h.drafted[e]??0,n=h.required[e]??0,r=h.needs[e]??0,i=h.blocked_positions.includes(e);return(0,s.jsxs)(`span`,{className:`draft-need-chip ${i?`blocked`:r>0?`short`:`met`}`,title:i?`BLOCKED`:r>0?`${r} more needed`:`Requirement met`,children:[e,` `,t,`/`,n,i&&(0,s.jsx)(`i`,{className:`bi bi-lock-fill`,style:{fontSize:`.6rem`}})]},e)}),(0,s.jsxs)(`span`,{className:`draft-need-chip north`,title:`North Melbourne players drafted`,children:[`NM `,h.north_count??0]})]}),(0,s.jsxs)(`div`,{className:`row g-2`,children:[(0,s.jsx)(`div`,{className:`col`,children:(0,s.jsx)(`input`,{type:`text`,className:`draft-filter-input w-100`,placeholder:`Search players...`,value:g,onChange:e=>ve(e.target.value)})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:_,onChange:e=>ye(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Pos`}),(0,s.jsx)(`option`,{value:`DEF`,children:`DEF`}),(0,s.jsx)(`option`,{value:`MID`,children:`MID`}),(0,s.jsx)(`option`,{value:`FWD`,children:`FWD`}),(0,s.jsx)(`option`,{value:`RUC`,children:`RUC`})]})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:v,onChange:e=>be(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Ages`}),(0,s.jsx)(`option`,{value:`new`,children:`New to the AFL`}),(0,s.jsx)(`option`,{value:`21`,children:`U21`}),(0,s.jsx)(`option`,{value:`23`,children:`U23`}),(0,s.jsx)(`option`,{value:`25`,children:`U25`}),(0,s.jsx)(`option`,{value:`25-30`,children:`25-30`}),(0,s.jsx)(`option`,{value:`30+`,children:`30+`})]})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:y,onChange:e=>xe(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Clubs`}),Ge.map(e=>(0,s.jsx)(`option`,{value:e,children:e},e))]})})]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,overflowX:`auto`,maxHeight:`70vh`},children:(0,s.jsxs)(`table`,{className:`table table-sm mb-0 draft-avail-tbl`,children:[(0,s.jsx)(`thead`,{children:(0,s.jsxs)(`tr`,{children:[[[`name`,`Player`],[`position`,`Pos`],[`afl_team`,`Team`],[`age`,`Age`],[`sc_avg`,t.tag?`SC ${t.tag}`:`SC`],[`rating`,`Rtg`],[`potential`,`Pot`],[`draft_score`,`Value`]].map(([e,t])=>(0,s.jsxs)(`th`,{className:`sortable-th${b===e?` active-sort`:``}`,onClick:()=>Ke(e),children:[t,` `,(0,s.jsx)(`i`,{className:`bi sort-icon ${qe(e)}`})]},e)),(0,s.jsx)(`th`,{})]})}),(0,s.jsx)(`tbody`,{children:We.map(e=>{let t=Ye(e.position);return(0,s.jsxs)(`tr`,{className:t?`blocked`:void 0,children:[(0,s.jsxs)(`td`,{className:`player-name`,children:[e.name,e.is_new&&(0,s.jsx)(`span`,{className:`pl-mark pl-mark-new`,children:`NEW`})]}),(0,s.jsx)(`td`,{children:e.position&&(0,s.jsxs)(`span`,{className:`draft-pos-chip ${c(e.position)}`,title:e.position_expected?`Expected position. He has no SuperCoach position yet.`:void 0,children:[e.position.split(`/`)[0],e.position_expected?` exp`:``]})}),(0,s.jsx)(`td`,{style:{color:`#b5a99c`},children:e.afl_team||``}),(0,s.jsx)(`td`,{style:{color:`#888076`},children:e.age??`-`}),(0,s.jsx)(`td`,{className:`stat-cell`,style:{color:`#c4b79d`},children:e.sc_avg==null?`-`:e.sc_avg.toFixed(1)}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip ${le(e.rating)}`,children:e.rating??`–`})}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip ${ue(e.potential)}`,children:e.potential??`–`})}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip draft-score`,children:e.draft_score==null?`–`:e.draft_score.toFixed(1)})}),(0,s.jsx)(`td`,{children:(0,s.jsxs)(`div`,{className:`d-flex gap-1 justify-content-end align-items-center`,children:[(0,s.jsx)(`button`,{className:`btn btn-sm py-0 px-2 ${M.has(e.id)?`btn-warning`:`btn-outline-secondary`}`,onClick:()=>M.has(e.id)?G(e.id):He(e.id),title:M.has(e.id)?`Remove from your queue`:`Add to your pre-draft queue`,style:{fontSize:`.7rem`},children:(0,s.jsx)(`i`,{className:`bi ${M.has(e.id)?`bi-bookmark-check-fill`:`bi-bookmark-plus`}`})}),(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,onClick:()=>q&&J(e.id),disabled:!q,title:t?`Position blocked — draft other positions first`:``,style:{fontSize:`.7rem`},children:t?(0,s.jsx)(`i`,{className:`bi bi-lock-fill`}):`Pick`})]})})]},e.id)})})]})})]})}),(0,s.jsx)(`div`,{className:`col-lg-5`,children:(0,s.jsxs)(`div`,{className:`draft-right-col`,children:[Y&&(()=>{let e=m.filter(e=>Pe.ids.has(e.id));return(0,s.jsxs)(`div`,{className:`card`,style:{flexShrink:0},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,s.jsxs)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${j===`queue`?` active`:``}`,onClick:()=>Ne(`queue`),style:{fontSize:`.72rem`,padding:`2px 10px`},children:[(0,s.jsx)(`i`,{className:`bi bi-bookmark-star me-1`}),`Queue`,A.length>0?` (${A.length})`:``]}),(0,s.jsxs)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${j===`wishlist`?` active`:``}`,onClick:()=>Ne(`wishlist`),style:{fontSize:`.72rem`,padding:`2px 10px`},children:[(0,s.jsx)(`i`,{className:`bi bi-star me-1`}),`Wishlist`,e.length>0?` (${e.length})`:``]})]}),j===`queue`&&A.length>0&&(0,s.jsx)(`span`,{className:`badge`,style:{background:`#272522`,color:`#a39586`,fontSize:`.68rem`},children:`auto-pick order`})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,maxHeight:240},children:j===`queue`?A.length===0?(0,s.jsxs)(`div`,{className:`text-center`,style:{color:`#888076`,fontSize:`.76rem`,padding:`14px 16px`,lineHeight:1.5},children:[`Tap `,(0,s.jsx)(`i`,{className:`bi bi-bookmark-plus`}),` on players to line up your picks. When it's your turn just hit `,(0,s.jsx)(`strong`,{children:`Pick`}),` here — and if your timer runs out, the top available player in this list is auto-drafted.`]}):(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:A.map((e,t)=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{style:{color:`#888076`,width:22},children:t+1}),(0,s.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,s.jsxs)(`td`,{className:`text-end`,style:{width:96,whiteSpace:`nowrap`},children:[(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,disabled:!q,onClick:()=>q&&J(e.player_id),style:{fontSize:`.68rem`},children:`Pick`}),(0,s.jsx)(`button`,{className:`btn btn-link p-0 ms-2`,onClick:()=>G(e.player_id),title:`Remove`,style:{color:`#f85149`,fontSize:`.8rem`},children:(0,s.jsx)(`i`,{className:`bi bi-x-lg`})})]})]},e.player_id))})}):e.length===0?(0,s.jsx)(`div`,{className:`text-center`,style:{color:`#888076`,fontSize:`.76rem`,padding:`14px 16px`,lineHeight:1.5},children:`Star players (★) anywhere in the app to build your wishlist — the available ones show here, ready to queue or draft.`}):(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:e.map(e=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{className:`player-name`,children:e.name}),(0,s.jsx)(`td`,{style:{width:48},children:e.position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.position)}`,children:e.position.split(`/`)[0]})}),(0,s.jsxs)(`td`,{className:`text-end`,style:{width:110,whiteSpace:`nowrap`},children:[(0,s.jsx)(`button`,{className:`btn btn-sm py-0 px-2 ${M.has(e.id)?`btn-warning`:`btn-outline-secondary`}`,onClick:()=>M.has(e.id)?G(e.id):He(e.id),title:M.has(e.id)?`Queued`:`Add to queue`,style:{fontSize:`.68rem`},children:(0,s.jsx)(`i`,{className:`bi ${M.has(e.id)?`bi-bookmark-check-fill`:`bi-bookmark-plus`}`})}),(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2 ms-1`,disabled:!q,onClick:()=>q&&J(e.id),style:{fontSize:`.68rem`},children:`Pick`})]})]},e.id))})})})]})})(),(0,s.jsxs)(`div`,{className:`card`,style:{flex:3},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-clock-history me-2`,style:{color:`#a39586`}}),`Pick History`]}),Y&&(0,s.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${w===`all`?` active`:``}`,onClick:()=>Oe(`all`),style:{fontSize:`.7rem`,padding:`2px 8px`},children:`All`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${w===`mine`?` active`:``}`,onClick:()=>Oe(`mine`),style:{fontSize:`.7rem`,padding:`2px 8px`},children:`Mine`})]})]}),(0,s.jsxs)(`span`,{className:`badge`,style:{background:`#272522`,color:`#a39586`,fontSize:`.75rem`},children:[f.picks_made,`/`,f.total_picks]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(0,s.jsxs)(`table`,{className:`table table-sm mb-0`,children:[(0,s.jsx)(`thead`,{className:`sticky-top`,children:(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`th`,{children:`#`}),(0,s.jsx)(`th`,{children:`Rd`}),(0,s.jsx)(`th`,{children:`Team`}),(0,s.jsx)(`th`,{children:`Player`}),(0,s.jsx)(`th`,{children:`Pos`}),(0,s.jsx)(`th`,{children:`AFL`})]})}),(0,s.jsx)(`tbody`,{children:gt.map(e=>(0,s.jsxs)(`tr`,{className:Y&&e.team_id===Y.id?`draft-pick-row-mine`:void 0,children:[(0,s.jsx)(`td`,{style:{color:`#888076`},children:e.pick_number}),(0,s.jsx)(`td`,{style:{color:`#888076`},children:e.round}),(0,s.jsxs)(`td`,{children:[e.team_name,e.via_team_name&&(0,s.jsxs)(`span`,{style:{color:`#b5a99c`,fontSize:`.85em`},children:[` via `,e.via_team_name]}),e.label&&(0,s.jsxs)(`span`,{style:{color:`#d26822`,fontSize:`.8em`,fontWeight:600},children:[` `,e.label]})]}),e.is_pass?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`td`,{children:(0,s.jsx)(`span`,{className:`draft-pass-tag`,children:`PASS`})}),(0,s.jsx)(`td`,{}),(0,s.jsx)(`td`,{})]}):(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)(`td`,{className:`player-name`,children:[e.player_name,e.is_auto_pick&&(0,s.jsx)(`span`,{className:`draft-auto-tag`,children:` (auto)`})]}),(0,s.jsx)(`td`,{children:e.player_position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#b5a99c`},children:e.player_afl_team})]})]},e.pick_number))})]})})]}),Y&&(0,s.jsxs)(`div`,{className:`card`,style:{flex:2},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-person-badge me-2`,style:{color:`#f5b940`}}),Y.name]}),(0,s.jsxs)(`span`,{className:`badge`,style:{background:`#272522`,color:`#a39586`,fontSize:`.75rem`},children:[ge.length,` players`]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(()=>{let e={DEF:[],MID:[],RUC:[],FWD:[],OTHER:[]};return ge.forEach(t=>{let n=(t.player_position||``).split(`/`)[0].toUpperCase();n===`DEF`||n===`MID`||n===`RUC`||n===`FWD`?e[n].push(t):e.OTHER.push(t)}),[`DEF`,`MID`,`RUC`,`FWD`,`OTHER`].map(t=>e[t].length===0?null:(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`draft-yt-section ${t===`OTHER`?``:t.toLowerCase()}`,children:[t,` · `,e[t].length]}),(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:e[t].map(e=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{style:{color:`#888076`,width:30},children:e.pick_number}),(0,s.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,s.jsx)(`td`,{style:{width:50},children:e.player_position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#b5a99c`,width:60},children:e.player_afl_team})]},e.pick_number))})})]},t))})()})]}),(0,s.jsxs)(`div`,{className:`card draft-chat-card`,children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,style:{cursor:`pointer`},onClick:et,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-chat-dots me-2`,style:{color:`#d26822`}}),`Draft Chat`]}),(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[Le>0&&(0,s.jsx)(`span`,{className:`badge`,style:{background:`#f85149`,fontSize:`.6rem`,borderRadius:8},children:Le}),(0,s.jsx)(`i`,{className:`bi bi-chevron-down${N?``:` chat-toggle-collapsed`}`,style:{color:`#a39586`,fontSize:`.75rem`,transition:`transform .2s`}})]})]}),N&&(0,s.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`},children:[(0,s.jsx)(`div`,{ref:L,id:`chat-messages`,className:`card-body p-0`,style:{overflowY:`auto`,padding:`.5rem !important`,maxHeight:180},children:P.length===0?(0,s.jsx)(`div`,{className:`text-center py-3`,style:{color:`#56504a`,fontSize:`.75rem`},children:(0,s.jsx)(`i`,{className:`bi bi-chat-dots`,style:{fontSize:`1.2rem`}})}):P.map((e,t)=>e.is_system?(0,s.jsx)(`div`,{className:`chat-msg-system`,children:e.message},t):(0,s.jsxs)(`div`,{className:`chat-msg`,children:[(0,s.jsx)(`span`,{className:`chat-msg-name`,style:{color:Qe(e.team_name)},children:e.team_name}),(0,s.jsx)(`span`,{className:`chat-msg-text`,children:e.message})]},t))}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid rgba(170,144,91,.12)`,padding:`8px 12px`,display:`flex`,gap:6},children:[(0,s.jsx)(`input`,{type:`text`,className:`draft-filter-input flex-grow-1`,placeholder:`Say something...`,maxLength:500,value:I,onChange:e=>Ie(e.target.value),onKeyDown:e=>{e.key===`Enter`&&(e.preventDefault(),$e())}}),(0,s.jsx)(`button`,{className:`btn btn-sm btn-primary`,onClick:$e,style:{padding:`4px 12px`,whiteSpace:`nowrap`},children:(0,s.jsx)(`i`,{className:`bi bi-send`})})]})]})]})]})})]}),T!=null&&Q&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>E(null),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#1c1a18`,border:`1px solid #373330`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #373330`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Confirm Pick`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>E(null)})]}),(0,s.jsxs)(`div`,{className:`text-center`,style:{padding:`1rem`},children:[(0,s.jsx)(`div`,{style:{fontSize:`1.1rem`,fontWeight:700,color:`#d7d1cb`},children:Q.name}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-center gap-2 mt-1`,children:[(0,s.jsx)(`span`,{className:`pos-badge badge-${c(Q.position)}`,children:Q.position}),(0,s.jsx)(`span`,{style:{fontSize:`.8rem`,color:`#a39586`},children:Q.afl_team})]})]}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #373330`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>E(null),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-primary btn-sm flex-fill`,onClick:Xe,children:`Confirm`})]})]})]}),ke&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>D(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#1c1a18`,border:`1px solid #373330`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #373330`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Pass Pick?`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>D(!1)})]}),(0,s.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,s.jsx)(`div`,{style:{fontSize:`.85rem`,color:`#a39586`},children:`Are you sure you want to pass on this pick? You won't draft a player this round.`})}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #373330`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>D(!1),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-warning btn-sm flex-fill`,onClick:Ze,children:`Pass`})]})]})]}),Ae&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>O(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#1c1a18`,border:`1px solid #373330`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #373330`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`,color:`#f85149`},children:`End Draft Early?`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>O(!1)})]}),(0,s.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,s.jsxs)(`div`,{style:{fontSize:`.85rem`,color:`#a39586`},children:[`All remaining picks will be marked as `,(0,s.jsx)(`strong`,{style:{color:`#d26822`},children:`PASS`}),` and the draft will be completed immediately.`]})}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #373330`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>O(!1),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-danger btn-sm flex-fill`,onClick:ut,children:`End Draft`})]})]})]})]})}var u=class extends o.Component{state={error:null};static getDerivedStateFromError(e){return{error:e}}componentDidCatch(e,t){console.error(`Draft room crash:`,e,t)}render(){return this.state.error?(0,s.jsx)(`div`,{className:`card mt-4`,children:(0,s.jsxs)(`div`,{className:`card-body`,children:[(0,s.jsxs)(`h5`,{style:{color:`#f85149`},children:[(0,s.jsx)(`i`,{className:`bi bi-exclamation-triangle me-2`}),`Draft room hit an error`]}),(0,s.jsx)(`p`,{style:{fontSize:`.85rem`,color:`#a39586`},children:`The draft data still loaded — this is a display glitch, not lost picks. Reload to try again.`}),(0,s.jsxs)(`pre`,{style:{fontSize:`.72rem`,color:`#a39586`,whiteSpace:`pre-wrap`,maxHeight:220,overflow:`auto`},children:[this.state.error.message,`
`,this.state.error.stack]}),(0,s.jsx)(`button`,{className:`btn btn-sm btn-outline-primary mt-2`,onClick:()=>window.location.reload(),children:`Reload`})]})}):this.props.children}};function d(){return(0,s.jsx)(u,{children:(0,s.jsx)(l,{})})}export{d as DraftRoomPage};