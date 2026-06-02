import{d as e,m as t,r as n,t as r,u as i,y as a}from"./jsx-runtime-mCRDCYrZ.js";import{n as ee}from"./api-BFFY-yxh.js";import{n as te,t as ne}from"./useWishlist-D1Xg3jVU.js";var o=a(t(),1),s=r();function re(){return(0,s.jsxs)(`div`,{className:`drsk`,children:[(0,s.jsxs)(`div`,{className:`drsk-clock`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-timer`}),(0,s.jsx)(`span`,{className:`kl-skel drsk-onclock`})]}),(0,s.jsxs)(`div`,{className:`drsk-cols`,children:[(0,s.jsxs)(`div`,{className:`drsk-col drsk-col-list`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-filter`}),Array.from({length:14}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-row`},t))]}),(0,s.jsxs)(`div`,{className:`drsk-col drsk-col-board`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-board-head`}),Array.from({length:6}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-board-row`},t))]})]}),(0,s.jsx)(`div`,{className:`drsk-history`,children:Array.from({length:8}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-pick`},t))})]})}var ie=[{key:`sc_average`,label:`SC Avg`},{key:`age_factor`,label:`Longevity`},{key:`positional_scarcity`,label:`Scarcity`},{key:`trajectory`,label:`Trajectory`},{key:`durability`,label:`Durability`},{key:`rating_potential`,label:`Growth`}],ae=[`#82b3e4`,`#7dc99a`,`#c2932f`,`#e07a6c`,`#b39ed4`,`#7ec0d3`,`#d68a7e`,`#f0d27a`],oe=`
/* === Draft room · Stadium ====================================== */

/* Banner — current pick + timer. Overrides the legacy GitHub-toned
   rules in global style.css. */
.draft-banner {
  background: rgba(15,22,36,.7) !important;
  border: 1px solid rgba(110,130,180,.18) !important;
  border-radius: 14px !important;
  padding: 16px 22px !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 14px !important;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.draft-banner-your-pick {
  border-color: rgba(58,125,196,.55) !important;
  background: linear-gradient(135deg, rgba(58,125,196,.14), rgba(58,125,196,.02)) !important;
  box-shadow: 0 0 32px -10px rgba(58,125,196,.4);
}
.draft-banner-complete {
  border-color: rgba(61,140,99,.5) !important;
  background: linear-gradient(135deg, rgba(61,140,99,.1), transparent) !important;
}
.draft-pick-badge {
  width: 52px !important;
  height: 52px !important;
  border-radius: 12px !important;
  background: rgba(20,28,45,.85) !important;
  border: 1px solid rgba(110,130,180,.3) !important;
  color: #f0f4fc !important;
  font-size: 1.2rem !important;
  font-weight: 800 !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.02em;
}
.draft-banner-your-pick .draft-pick-badge {
  background: rgba(58,125,196,.18) !important;
  border-color: rgba(58,125,196,.5) !important;
  color: #a8c8ed !important;
}
.draft-pick-badge.scheduled { background: rgba(58,125,196,.12) !important; border-color: rgba(58,125,196,.32) !important; color: #82b3e4 !important; }
.draft-timer {
  font-size: 2.4rem !important;
  font-weight: 900 !important;
  font-family: inherit !important;
  color: #f5f8ff !important;
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
  color: #6c7892 !important;
  font-weight: 700 !important;
  margin-top: 4px !important;
}
.draft-banner-round { font-size: .56rem; color: #6c7892; letter-spacing: .16em; text-transform: uppercase; font-weight: 800; }
.draft-banner-team { font-size: 1.15rem; font-weight: 800; color: #f0f4fc; letter-spacing: -.005em; }
.draft-your-pick-pill {
  display: inline-flex;
  align-items: center;
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .18em;
  padding: 3px 9px;
  border-radius: 4px;
  background: rgba(58,125,196,.2);
  color: #a8c8ed;
  border: 1px solid rgba(58,125,196,.5);
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
  background: rgba(15,22,36,.7);
  border: 1px solid rgba(110,130,180,.18);
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
  background: linear-gradient(90deg, rgba(58,125,196,.6) 0%, rgba(138,109,184,.6) 50%, rgba(184,127,61,.6) 100%);
}
.draft-event-countdown {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f0f4fc;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.01em;
  line-height: 1.1;
  margin-top: 4px;
}
.draft-event-countdown.soon { color: #7dc99a; }
.draft-event-time { font-size: .82rem; color: #97a3ba; }

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
.draft-header-info { font-size: .78rem; color: #97a3ba; letter-spacing: .02em; }

/* Available players card */
.draft-avail-tbl { width: 100%; font-size: .82rem; }
.draft-avail-tbl thead th {
  font-size: .58rem !important;
  font-weight: 800 !important;
  letter-spacing: .14em !important;
  color: #6c7892 !important;
  background: rgba(11,16,28,.7) !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid rgba(110,130,180,.18) !important;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 2;
}
.draft-avail-tbl tbody td {
  padding: 8px 12px;
  font-size: .82rem;
  border-bottom: 1px solid rgba(110,130,180,.06);
  color: #dde4f1;
  vertical-align: middle;
}
.draft-avail-tbl tbody tr { transition: background .14s; }
.draft-avail-tbl tbody tr:hover { background: rgba(58,125,196,.06); }
.draft-avail-tbl tbody tr:hover .player-name { color: #a8c8ed; }
.draft-avail-tbl .player-name { font-weight: 600; color: #f0f4fc; white-space: nowrap; }
.draft-avail-tbl .stat-cell { font-weight: 700; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; text-align: right; }
.draft-avail-tbl tbody tr.blocked { opacity: .45; }

/* Sortable headers */
.sortable-th { cursor: pointer; user-select: none; white-space: nowrap; transition: color .14s; }
.sortable-th:hover { color: #b6c0d3 !important; }
.sortable-th .sort-icon { display: inline-block; margin-left: 4px; font-size: .55rem; opacity: .25; transition: opacity .14s, color .14s; }
.sortable-th.active-sort { color: #dde4f1 !important; }
.sortable-th.active-sort .sort-icon { opacity: 1; color: #82b3e4; }

/* Position chips — match Gameday DEF/MID/RUC/FWD palette */
.draft-pos-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 22px; border-radius: 5px;
  font-size: .56rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3;
}
.draft-pos-chip.def { background: rgba(61,138,156,.14); color: #7ec0d3; border-color: rgba(61,138,156,.3); }
.draft-pos-chip.mid { background: rgba(58,125,196,.14); color: #82b3e4; border-color: rgba(58,125,196,.3); }
.draft-pos-chip.ruc { background: rgba(138,109,184,.14); color: #b39ed4; border-color: rgba(138,109,184,.3); }
.draft-pos-chip.fwd { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.3); }

/* Rating / potential / draft-score numeric chips */
.draft-stat-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 22px; padding: 0 7px; border-radius: 5px;
  font-size: .74rem; font-weight: 800; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
  background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3;
}
.draft-stat-chip.tier-elite { background: rgba(194,147,47,.2); color: #f0d27a; border-color: rgba(194,147,47,.45); box-shadow: 0 0 10px -2px rgba(194,147,47,.3); }
.draft-stat-chip.tier-good { background: rgba(58,125,196,.16); color: #82b3e4; border-color: rgba(58,125,196,.35); }
.draft-stat-chip.tier-ok { background: rgba(138,109,184,.12); color: #b39ed4; border-color: rgba(138,109,184,.3); }
.draft-stat-chip.tier-low { background: rgba(184,90,74,.1); color: #d68a7e; border-color: rgba(184,90,74,.25); }
.draft-stat-chip.tier-empty { color: #5a677e; background: transparent; border-color: transparent; }
.draft-stat-chip.draft-score { background: rgba(58,125,196,.18); color: #a8c8ed; border-color: rgba(58,125,196,.4); }

/* Position-need chips (sit above filter row) */
.draft-need-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .66rem; padding: 3px 9px; border-radius: 6px;
  font-weight: 700; letter-spacing: .04em;
  background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3;
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
}
.draft-need-chip.met { background: rgba(61,140,99,.12); color: #7dc99a; border-color: rgba(61,140,99,.3); }
.draft-need-chip.short { background: rgba(194,147,47,.12); color: #f0d27a; border-color: rgba(194,147,47,.3); }
.draft-need-chip.blocked { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.36); }
.draft-need-chip.north { background: rgba(58,125,196,.12); color: #82b3e4; border-color: rgba(58,125,196,.32); }

/* Filter row */
.draft-filter-input, .draft-filter-select {
  background: rgba(15,22,36,.55) !important;
  border: 1px solid rgba(110,130,180,.2) !important;
  color: #dde4f1 !important;
  border-radius: 8px !important;
  padding: 7px 12px !important;
  font-size: .78rem !important;
  height: auto !important;
}
.draft-filter-input:focus, .draft-filter-select:focus { border-color: rgba(58,125,196,.55) !important; outline: 0 !important; box-shadow: 0 0 0 2px rgba(58,125,196,.15) !important; }
.draft-filter-input::placeholder { color: #6c7892; }

/* Values panel (weight sliders) */
.draft-values-panel {
  background: rgba(11,16,28,.6);
  border: 1px solid rgba(110,130,180,.16);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.draft-values-row { display: flex; align-items: center; gap: 12px; margin-bottom: 9px; }
.draft-values-row:last-of-type { margin-bottom: 4px; }
.draft-values-label { font-size: .68rem; color: #97a3ba; font-weight: 700; letter-spacing: .04em; width: 68px; flex-shrink: 0; }
.draft-values-value { font-size: .72rem; color: #82b3e4; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; min-width: 36px; text-align: right; font-weight: 700; }
.draft-values-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(110,130,180,.12); }
.draft-values-foot-meta { font-size: .68rem; color: #6c7892; }
.draft-values-foot-meta .custom { color: #7dc99a; font-weight: 700; }

input[type="range"].draft-slider {
  appearance: none;
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: rgba(110,130,180,.2);
  border-radius: 2px;
  outline: none;
}
input[type="range"].draft-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #3a7dc4;
  border: 2px solid #f0f4fc;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.4);
}
input[type="range"].draft-slider::-moz-range-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #3a7dc4;
  border: 2px solid #f0f4fc;
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
  background: rgba(15,22,36,.7) !important;
  border: 1px solid rgba(110,130,180,.18) !important;
  border-radius: 12px !important;
}
.draft-right-col > .card > .card-body { overflow-y: auto; flex: 1; min-height: 0; }
.draft-right-col .card-header {
  background: rgba(20,28,45,.55) !important;
  border-bottom: 1px solid rgba(110,130,180,.12) !important;
  padding: 11px 14px !important;
  color: #dde4f1;
}
.draft-right-col .card-header h5 { color: #f0f4fc; font-size: .88rem; font-weight: 800; letter-spacing: -.005em; }
.draft-right-col .card-header .badge {
  background: rgba(110,130,180,.16) !important;
  color: #b6c0d3 !important;
  font-size: .66rem !important;
  font-weight: 700 !important;
  padding: 3px 8px !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
}

/* Tables inside right-col cards */
.draft-right-col table { color: #dde4f1; margin: 0; }
.draft-right-col table thead th {
  font-size: .56rem !important;
  font-weight: 800 !important;
  letter-spacing: .14em !important;
  color: #6c7892 !important;
  background: rgba(11,16,28,.75) !important;
  padding: 8px 10px !important;
  border-bottom: 1px solid rgba(110,130,180,.18) !important;
  text-transform: uppercase;
}
.draft-right-col table tbody td {
  padding: 6px 10px !important;
  border-bottom: 1px solid rgba(110,130,180,.06) !important;
  font-size: .76rem;
  color: #dde4f1;
  vertical-align: middle;
}
.draft-right-col table tbody tr { transition: background .14s; }
.draft-right-col table tbody tr:hover { background: rgba(58,125,196,.05); }
.draft-pick-row-mine td { background: rgba(58,125,196,.08); color: #a8c8ed !important; }
.draft-pick-row-mine .player-name { color: #a8c8ed !important; }
.draft-auto-tag { color: #6c7892; font-size: .62rem; letter-spacing: .02em; }
.draft-pass-tag { color: #f0d27a; font-weight: 800; font-size: .68rem; letter-spacing: .12em; }

/* Your-team grouping section */
.draft-yt-section {
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #6c7892;
  background: rgba(11,16,28,.6);
  padding: 6px 12px;
  border-left: 2px solid rgba(110,130,180,.3);
}
.draft-yt-section.def { color: #7ec0d3; border-left-color: rgba(61,138,156,.5); }
.draft-yt-section.mid { color: #82b3e4; border-left-color: rgba(58,125,196,.45); }
.draft-yt-section.ruc { color: #b39ed4; border-left-color: rgba(138,109,184,.5); }
.draft-yt-section.fwd { color: #e07a6c; border-left-color: rgba(184,90,74,.45); }

/* Chat — wider re-skin */
.draft-chat-card { flex-shrink: 0; flex-grow: 0; min-height: auto !important; }
.draft-chat-card #chat-messages { max-height: 180px; }
.chat-msg { padding: 5px 12px; font-size: .76rem; border-bottom: 1px solid rgba(110,130,180,.06); }
.chat-msg:last-child { border-bottom: none; }
.chat-msg-name { font-weight: 800; font-size: .68rem; margin-right: 6px; letter-spacing: .02em; }
.chat-msg-text { color: #dde4f1; word-break: break-word; }
.chat-msg-system { text-align: center; font-size: .66rem; color: #6c7892; font-style: italic; padding: 4px 12px; }
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
`;function se(e){if(e<=0)return`Starting soon...`;let t=Math.floor(e/1e3),n=Math.floor(t/86400),r=Math.floor(t%86400/3600),i=Math.floor(t%3600/60),a=t%60;return n>0?`${n}d ${r}h ${i}m`:r>0?`${r}h ${i}m ${a}s`:i>0?`${i}m ${a}s`:`${a}s`}function c(e){return e?e.split(`/`)[0].toLowerCase():`mid`}function ce(e){return e==null?`tier-empty`:e>=80?`tier-elite`:e>=70?`tier-good`:e>=60?`tier-ok`:`tier-low`}function le(e){return e==null?`tier-empty`:e>=80?`tier-elite`:e>=70?`tier-good`:e>=60?`tier-ok`:`tier-low`}function l(){let{leagueId:t}=e(),r=i(),[a,l]=(0,o.useState)(null),[u,ue]=(0,o.useState)(null),[de,fe]=(0,o.useState)(!0),[d,f]=(0,o.useState)(null),[p,pe]=(0,o.useState)([]),[m,me]=(0,o.useState)(null),[he,ge]=(0,o.useState)([]),[h,_e]=(0,o.useState)(``),[g,ve]=(0,o.useState)(``),[_,ye]=(0,o.useState)(``),[v,be]=(0,o.useState)(``),[y,xe]=(0,o.useState)(`draft_score`),[b,Se]=(0,o.useState)(`desc`),[x,S]=(0,o.useState)({}),[Ce,we]=(0,o.useState)(!1),[Te,Ee]=(0,o.useState)(!1),[C,De]=(0,o.useState)(`all`),[w,T]=(0,o.useState)(null),[Oe,E]=(0,o.useState)(!1),[ke,D]=(0,o.useState)(!1),[O,Ae]=(0,o.useState)(!1),[k,je]=(0,o.useState)([]),[A,Me]=(0,o.useState)(`queue`),Ne=ne(t),j=(0,o.useMemo)(()=>new Set(k.map(e=>e.player_id)),[k]),[M,Pe]=(0,o.useState)(()=>typeof window<`u`&&window.innerWidth>=992),[N,P]=(0,o.useState)([]),[F,Fe]=(0,o.useState)(``),[Ie,Le]=(0,o.useState)(0),I=(0,o.useRef)(null),L=(0,o.useRef)({}),[Re,R]=(0,o.useState)(``),[ze,Be]=(0,o.useState)(``),z=(0,o.useRef)(null);(0,o.useEffect)(()=>{fe(!0),ee(`/leagues/${t}/draft?format=json`).then(e=>{if(`empty_state`in e){ue(e);return}l(e),f(e.state),S(e.user_weights),Ee(e.has_custom_weights),e.session.scheduled_start&&R(e.session.scheduled_start.slice(0,16))}).catch(()=>{}).finally(()=>fe(!1))},[t]),(0,o.useEffect)(()=>{z.current&&window.clearInterval(z.current);let e=a?.session.scheduled_start;if(!e||d?.status!==`scheduled`){Be(e?``:`No time set`);return}let t=()=>{Be(se(new Date(e).getTime()-Date.now()))};return t(),z.current=window.setInterval(t,1e3),()=>{z.current&&window.clearInterval(z.current)}},[a?.session.scheduled_start,d?.status]);let B=(0,o.useCallback)(()=>{a?.user_team&&fetch(`/leagues/${t}/draft/api/position_needs`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>{e.error||me(e)}).catch(()=>{})},[t,a?.user_team]),V=(0,o.useCallback)(()=>{a?.user_team&&fetch(`/leagues/${t}/draft/api/team_picks/${a.user_team.id}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>ge(Array.isArray(e)?e:[])).catch(()=>{})},[t,a?.user_team]),H=(0,o.useCallback)(()=>{let e=ie.map(e=>`w_${e.key}=${x[e.key]??.2}`).join(`&`),n=v?800:200,r=new URLSearchParams;r.set(`q`,h),g&&r.set(`pos`,g),r.set(`limit`,String(n)),fetch(`/leagues/${t}/draft/api/available?${r.toString()}&${e}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>pe(Array.isArray(e)?e:[])).catch(()=>pe([]))},[t,h,g,v,x]),U=(0,o.useCallback)(()=>{a?.user_team&&fetch(`/leagues/${t}/draft/api/queue`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>je(Array.isArray(e)?e:[])).catch(()=>{})},[t,a?.user_team]),Ve=(0,o.useCallback)(e=>{fetch(`/leagues/${t}/draft/api/queue`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({player_id:e}),credentials:`same-origin`}).then(()=>U()).catch(()=>{})},[t,U]),W=(0,o.useCallback)(e=>{fetch(`/leagues/${t}/draft/api/queue`,{method:`DELETE`,headers:{"Content-Type":`application/json`},body:JSON.stringify({player_id:e}),credentials:`same-origin`}).then(()=>U()).catch(()=>{})},[t,U]);(0,o.useEffect)(()=>{a&&H()},[a,H]),(0,o.useEffect)(()=>{a&&(B(),V(),U())},[a,B,V,U]),(0,o.useEffect)(()=>{a&&fetch(`/leagues/${t}/draft/api/chat_history`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>P(Array.isArray(e)?e:[])).catch(()=>{})},[t,a]),(0,o.useEffect)(()=>{I.current&&(I.current.scrollTop=I.current.scrollHeight)},[N,M]);let{socket:G,state:He}=te({namespace:`/draft`,onConnect:e=>e.emit(`join_draft`,{league_id:Number(t)}),events:{draft_state:e=>{f(e),B(),V(),H(),U()},pick_made:e=>{let t=e;f(e=>e&&{...e,pick_history:[t,...e.pick_history],picks_made:e.picks_made+1,picked_player_ids:t.player_id?[...e.picked_player_ids,t.player_id]:e.picked_player_ids}),P(e=>[...e,{team_name:t.team_name,message:t.is_pass?`${t.team_name} passed`:`${t.team_name} drafted ${t.player_name}`,is_system:!0}]),B(),H(),t.team_id===a?.user_team?.id&&V()},timer_tick:e=>{let{remaining:t}=e;f(e=>e&&{...e,timer_remaining:t})},draft_completed:e=>{f({...e,status:`completed`})},draft_chat_msg:e=>{let t=e;P(e=>[...e,t]),M||Le(e=>e+1)},schedule_updated:e=>{let{scheduled_start:t}=e;l(e=>e&&{...e,session:{...e.session,scheduled_start:t}}),t&&R(t.slice(0,16))},error:e=>alert(e.message)}}),Ue=(0,o.useMemo)(()=>{let e=p.filter(e=>!(d&&e.id!=null&&d.picked_player_ids.includes(e.id)));_&&(e=e.filter(e=>e.age==null?!1:_===`30+`?e.age>=30:_===`25-30`?e.age>=25&&e.age<=30:e.age<parseInt(_))),v&&(e=e.filter(e=>e.afl_team===v));let t=b===`asc`?1:-1;return e.slice().sort((e,n)=>{let r=e[y],i=n[y];return r==null&&i==null?0:r==null?1:i==null?-1:typeof r==`string`&&typeof i==`string`?t*r.localeCompare(i):t*(r-i)}).slice(0,100)},[p,_,v,y,b,d]),We=(0,o.useMemo)(()=>{let e=new Set;return p.forEach(t=>{t.afl_team&&e.add(t.afl_team)}),[...e].sort()},[p]),Ge=e=>{y===e?Se(e=>e===`desc`?`asc`:`desc`):(xe(e),Se([`name`,`position`,`afl_team`].includes(e)?`asc`:`desc`))},Ke=e=>y===e?b===`desc`?`bi-chevron-down`:`bi-chevron-up`:`bi-chevron-expand`,qe=!!(a?.user_team&&d?.current_team_id===a.user_team.id),K=d?.status===`in_progress`&&(qe||a?.is_commissioner&&O);function Je(e){return!m||!m.blocked_positions.length||!e?!1:e.split(`/`).map(e=>e.trim().toUpperCase()).every(e=>m.blocked_positions.includes(e))}function q(e){if(!G?.connected){alert(`Not connected — refresh the page.`);return}T(e)}function Ye(){w==null||!G||(G.emit(`make_pick`,{league_id:Number(t),player_id:w}),T(null))}function Xe(){G?.emit(`pass_pick`,{league_id:Number(t)}),E(!1)}function Ze(e){if(!L.current[e]){let t=Object.keys(L.current).length;L.current[e]=ae[t%ae.length]}return L.current[e]}function Qe(){!F.trim()||!G||(G.emit(`draft_chat`,{league_id:Number(t),message:F.trim()}),Fe(``))}function $e(){let e=!M;Pe(e),e&&Le(0)}function et(e,t){S(n=>({...n,[e]:t}))}function tt(){H()}async function nt(){try{let e=await(await fetch(`/leagues/${t}/draft/api/save_weights`,{method:`POST`,credentials:`same-origin`,headers:{"Content-Type":`application/json`},body:JSON.stringify(x)})).json();e.status===`ok`&&(e.weights&&S(e.weights),Ee(!0),H())}catch{}}function rt(){G?.emit(`update_schedule`,{league_id:Number(t),scheduled_start:Re||null})}function it(){G?.emit(`start_draft`,{league_id:Number(t)})}function at(){confirm(`Pause the draft? All timers will stop.`)&&G?.emit(`pause_draft`,{league_id:Number(t)})}function ot(){G?.emit(`resume_draft`,{league_id:Number(t)})}function st(){confirm(`Undo the last pick?`)&&G?.emit(`undo_pick`,{league_id:Number(t)})}function ct(){if(!confirm(`Are you sure you want to restart the draft?

This will DELETE the current draft session, remove all drafted players from rosters, and take you to settings where you can make changes before re-drafting.

This cannot be undone.`))return;let e=new FormData;e.set(`action`,`restart_draft`),fetch(`/leagues/${t}/draft/setup`,{method:`POST`,body:e,credentials:`same-origin`}).then(()=>r(`/leagues/${t}/settings`))}async function lt(){let e=new FormData;try{await fetch(`/leagues/${t}/draft/api/end`,{method:`POST`,body:e,credentials:`same-origin`}),D(!1)}catch{}}if(de)return(0,s.jsx)(re,{});if(u)return(0,s.jsx)(`div`,{children:(0,s.jsxs)(`div`,{className:`empty-state`,children:[(0,s.jsx)(`div`,{className:`empty-icon`,children:(0,s.jsx)(`i`,{className:`bi bi-list-check`})}),(0,s.jsx)(`h4`,{children:`No draft scheduled yet`}),(0,s.jsx)(`p`,{children:u.is_commissioner?`Set up a draft session to get everyone in the room. While you wait, you can plan your picks in the player pool.`:`Your commissioner hasn't scheduled the next draft. You can still browse the player pool and plan your picks.`}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-center gap-2 flex-wrap`,children:[(0,s.jsxs)(n,{to:`/leagues/${t}/player-pool`,className:`btn btn-primary btn-sm`,children:[(0,s.jsx)(`i`,{className:`bi bi-search me-1`}),`Browse player pool`]}),u.is_commissioner&&(0,s.jsxs)(n,{to:`/leagues/${t}/draft/setup`,className:`btn btn-outline-primary btn-sm`,children:[(0,s.jsx)(`i`,{className:`bi bi-calendar-plus me-1`}),`Set up draft`]}),(0,s.jsxs)(n,{to:`/leagues/${t}/player-ratings`,className:`btn btn-outline-secondary btn-sm`,children:[(0,s.jsx)(`i`,{className:`bi bi-star me-1`}),`Player ratings`]})]})]})});if(!a||!d)return(0,s.jsx)(`p`,{className:`text-danger`,children:`Failed to load draft room`});let{league:J,user_team:Y,is_commissioner:ut,can_restart:dt,session:X}=a,Z=X.scheduled_start?new Date(X.scheduled_start):null,ft=Z?Z.toLocaleDateString(`en-AU`,{weekday:`short`,day:`numeric`,month:`short`})+`, `+Z.toLocaleTimeString(`en-AU`,{hour:`numeric`,minute:`2-digit`}):``,Q=w==null?null:p.find(e=>e.id===w),pt=qe&&d.status===`in_progress`,$=d.status===`completed`,mt=C===`mine`&&Y?d.pick_history.filter(e=>e.team_name===Y.name):d.pick_history;return(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`style`,{children:oe}),(0,s.jsxs)(`div`,{className:`page-header`,children:[(0,s.jsxs)(`div`,{className:`page-breadcrumb`,children:[(0,s.jsx)(n,{to:`/leagues/${t}`,children:J.name}),` / Draft Room`]}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-start flex-wrap gap-2`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h2`,{className:`mb-0`,children:`Live Draft`}),(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3 mt-1`,children:[(0,s.jsx)(`span`,{className:`conn-dot${He===`connected`?``:` off`}`,title:He===`connected`?`Connected`:`Disconnected`}),(0,s.jsx)(`span`,{className:`status-pill status-${d.status.replace(`_`,`-`)}`,children:d.status}),(0,s.jsxs)(`span`,{className:`draft-header-info`,children:[J.draft_type.charAt(0).toUpperCase()+J.draft_type.slice(1),` · `,X.pick_timer_secs,`s timer`]})]})]}),ut&&(0,s.jsxs)(`div`,{className:`d-flex gap-2 align-items-center flex-wrap`,children:[(0,s.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm${O?` active`:``}`,onClick:()=>Ae(e=>!e),style:{fontSize:`.7rem`},title:`Pick on behalf of other teams`,children:[(0,s.jsx)(`i`,{className:`bi bi-shield${O?`-fill-check`:``} me-1`}),O?`Override ON`:`Override`]}),d.status===`scheduled`&&(0,s.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:it,children:[(0,s.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Start Draft`]}),d.status===`in_progress`&&(0,s.jsxs)(`button`,{className:`btn btn-outline-secondary btn-sm`,onClick:at,children:[(0,s.jsx)(`i`,{className:`bi bi-pause-fill me-1`}),`Pause`]}),d.status===`paused`&&(0,s.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:ot,children:[(0,s.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Resume`]}),d.picks_made>0&&(d.status===`in_progress`||d.status===`paused`)&&(0,s.jsxs)(`button`,{className:`btn btn-outline-info btn-sm`,onClick:st,style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Undo`]}),(d.status===`in_progress`||d.status===`paused`)&&(0,s.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:()=>D(!0),style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-stop-fill me-1`}),`End Draft`]}),dt&&(0,s.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:ct,style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Restart`]})]})]})]}),d.status===`scheduled`?(0,s.jsxs)(`div`,{className:`draft-event`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,s.jsx)(`div`,{className:`draft-pick-badge scheduled`,children:(0,s.jsx)(`i`,{className:`bi bi-hourglass-split`})}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`div`,{className:`draft-banner-round`,children:`Draft Starts In`}),(0,s.jsx)(`div`,{className:`draft-event-countdown${ze===`Starting soon...`?` soon`:``}`,children:ze}),ft&&(0,s.jsx)(`div`,{className:`draft-event-time`,children:ft})]})]}),ut&&(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,s.jsx)(`input`,{type:`datetime-local`,className:`draft-filter-input`,value:Re,onChange:e=>R(e.target.value),style:{width:`auto`}}),(0,s.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm`,onClick:rt,style:{fontSize:`.7rem`,whiteSpace:`nowrap`},children:[(0,s.jsx)(`i`,{className:`bi bi-clock me-1`}),`Set Time`]})]})]}):(0,s.jsxs)(`div`,{className:`draft-banner${pt?` draft-banner-your-pick`:``}${$?` draft-banner-complete`:``}`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,s.jsx)(`div`,{className:`draft-pick-badge`,children:(0,s.jsx)(`span`,{children:d.current_pick||`-`})}),(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`draft-banner-round`,children:[`Round `,d.current_round||`-`]}),(0,s.jsxs)(`div`,{className:`draft-banner-team`,children:[$?`Draft Complete`:d.current_team_name||`TBD`,pt&&(0,s.jsx)(`span`,{className:`draft-your-pick-pill`,children:`Your Pick`})]})]})]}),X.pick_timer_secs>0?(0,s.jsxs)(`div`,{className:`draft-timer-block`,children:[(0,s.jsx)(`span`,{className:`draft-timer${(d.timer_remaining??0)<=10&&d.timer_remaining!=null?` timer-urgent`:``}`,children:$?`-`:d.timer_remaining??X.pick_timer_secs}),(0,s.jsx)(`span`,{className:`draft-timer-label`,children:`seconds`})]}):(0,s.jsx)(`div`,{className:`draft-timer-block`,children:(0,s.jsxs)(`span`,{className:`draft-timer-label`,children:[(0,s.jsx)(`i`,{className:`bi bi-infinity me-1`}),`Untimed`]})})]}),(0,s.jsxs)(`div`,{className:`row g-3`,children:[(0,s.jsx)(`div`,{className:`col-lg-7`,children:(0,s.jsxs)(`div`,{className:`card`,style:{display:`flex`,flexDirection:`column`},children:[(0,s.jsxs)(`div`,{className:`card-header`,children:[(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center mb-2`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-people me-2`,style:{color:`#8b949e`}}),`Available Players`]}),(0,s.jsxs)(`div`,{className:`d-flex gap-1 align-items-center`,children:[d.status===`in_progress`&&(0,s.jsxs)(`button`,{className:`btn btn-outline-warning py-0 px-2`,onClick:()=>E(!0),disabled:!K,style:{fontSize:`.7rem`},title:K?`Pass on this pick`:`You can pass when it’s your turn`,children:[(0,s.jsx)(`i`,{className:`bi bi-skip-forward me-1`}),`Pass`]}),(0,s.jsxs)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,type:`button`,onClick:()=>we(e=>!e),style:{fontSize:`.7rem`},title:`Adjust your draft value weights`,children:[(0,s.jsx)(`i`,{className:`bi bi-sliders me-1`}),`Values`]})]})]}),Ce&&(0,s.jsxs)(`div`,{className:`draft-values-panel`,children:[ie.map(({key:e,label:t})=>(0,s.jsxs)(`div`,{className:`draft-values-row`,children:[(0,s.jsx)(`span`,{className:`draft-values-label`,children:t}),(0,s.jsx)(`input`,{type:`range`,className:`draft-slider`,min:0,max:1,step:.01,value:x[e]??.2,onChange:t=>et(e,parseFloat(t.target.value))}),(0,s.jsxs)(`span`,{className:`draft-values-value`,children:[Math.round((x[e]??.2)*100),`%`]})]},e)),(0,s.jsxs)(`div`,{className:`draft-values-foot`,children:[(0,s.jsx)(`span`,{className:`draft-values-foot-meta`,children:Te?(0,s.jsx)(`span`,{className:`custom`,children:`Custom`}):`League defaults`}),(0,s.jsxs)(`div`,{className:`d-flex gap-1`,children:[(0,s.jsx)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,onClick:tt,style:{fontSize:`.7rem`},children:`Apply`}),(0,s.jsx)(`button`,{className:`btn btn-primary py-0 px-2`,onClick:nt,style:{fontSize:`.7rem`},children:`Save`})]})]})]}),m&&Y&&(0,s.jsxs)(`div`,{className:`d-flex gap-2 mb-2 flex-wrap`,children:[[`DEF`,`MID`,`FWD`,`RUC`].map(e=>{let t=m.drafted[e]??0,n=m.required[e]??0,r=m.needs[e]??0,i=m.blocked_positions.includes(e);return(0,s.jsxs)(`span`,{className:`draft-need-chip ${i?`blocked`:r>0?`short`:`met`}`,title:i?`BLOCKED`:r>0?`${r} more needed`:`Requirement met`,children:[e,` `,t,`/`,n,i&&(0,s.jsx)(`i`,{className:`bi bi-lock-fill`,style:{fontSize:`.6rem`}})]},e)}),(0,s.jsxs)(`span`,{className:`draft-need-chip north`,title:`North Melbourne players drafted`,children:[`NM `,m.north_count??0]})]}),(0,s.jsxs)(`div`,{className:`row g-2`,children:[(0,s.jsx)(`div`,{className:`col`,children:(0,s.jsx)(`input`,{type:`text`,className:`draft-filter-input w-100`,placeholder:`Search players...`,value:h,onChange:e=>_e(e.target.value)})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:g,onChange:e=>ve(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Pos`}),(0,s.jsx)(`option`,{value:`DEF`,children:`DEF`}),(0,s.jsx)(`option`,{value:`MID`,children:`MID`}),(0,s.jsx)(`option`,{value:`FWD`,children:`FWD`}),(0,s.jsx)(`option`,{value:`RUC`,children:`RUC`})]})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:_,onChange:e=>ye(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Ages`}),(0,s.jsx)(`option`,{value:`21`,children:`U21`}),(0,s.jsx)(`option`,{value:`23`,children:`U23`}),(0,s.jsx)(`option`,{value:`25`,children:`U25`}),(0,s.jsx)(`option`,{value:`25-30`,children:`25-30`}),(0,s.jsx)(`option`,{value:`30+`,children:`30+`})]})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:v,onChange:e=>be(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Clubs`}),We.map(e=>(0,s.jsx)(`option`,{value:e,children:e},e))]})})]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,overflowX:`auto`,maxHeight:`70vh`},children:(0,s.jsxs)(`table`,{className:`table table-sm mb-0 draft-avail-tbl`,children:[(0,s.jsx)(`thead`,{children:(0,s.jsxs)(`tr`,{children:[[[`name`,`Player`],[`position`,`Pos`],[`afl_team`,`Team`],[`age`,`Age`],[`sc_avg`,`SC`],[`rating`,`Rtg`],[`potential`,`Pot`],[`draft_score`,`Value`]].map(([e,t])=>(0,s.jsxs)(`th`,{className:`sortable-th${y===e?` active-sort`:``}`,onClick:()=>Ge(e),children:[t,` `,(0,s.jsx)(`i`,{className:`bi sort-icon ${Ke(e)}`})]},e)),(0,s.jsx)(`th`,{})]})}),(0,s.jsx)(`tbody`,{children:Ue.map(e=>{let t=Je(e.position);return(0,s.jsxs)(`tr`,{className:t?`blocked`:void 0,children:[(0,s.jsx)(`td`,{className:`player-name`,children:e.name}),(0,s.jsx)(`td`,{children:e.position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.position)}`,children:e.position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#97a3ba`},children:e.afl_team||``}),(0,s.jsx)(`td`,{style:{color:`#6c7892`},children:e.age??`-`}),(0,s.jsx)(`td`,{className:`stat-cell`,style:{color:`#b6c0d3`},children:e.sc_avg==null?`-`:e.sc_avg.toFixed(1)}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip ${ce(e.rating)}`,children:e.rating??`–`})}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip ${le(e.potential)}`,children:e.potential??`–`})}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip draft-score`,children:e.draft_score==null?`–`:e.draft_score.toFixed(1)})}),(0,s.jsx)(`td`,{children:(0,s.jsxs)(`div`,{className:`d-flex gap-1 justify-content-end align-items-center`,children:[(0,s.jsx)(`button`,{className:`btn btn-sm py-0 px-2 ${j.has(e.id)?`btn-warning`:`btn-outline-secondary`}`,onClick:()=>j.has(e.id)?W(e.id):Ve(e.id),title:j.has(e.id)?`Remove from your queue`:`Add to your pre-draft queue`,style:{fontSize:`.7rem`},children:(0,s.jsx)(`i`,{className:`bi ${j.has(e.id)?`bi-bookmark-check-fill`:`bi-bookmark-plus`}`})}),(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,onClick:()=>K&&q(e.id),disabled:!K,title:t?`Position blocked — draft other positions first`:``,style:{fontSize:`.7rem`},children:t?(0,s.jsx)(`i`,{className:`bi bi-lock-fill`}):`Pick`})]})})]},e.id)})})]})})]})}),(0,s.jsx)(`div`,{className:`col-lg-5`,children:(0,s.jsxs)(`div`,{className:`draft-right-col`,children:[Y&&(()=>{let e=p.filter(e=>Ne.ids.has(e.id));return(0,s.jsxs)(`div`,{className:`card`,style:{flexShrink:0},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,s.jsxs)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${A===`queue`?` active`:``}`,onClick:()=>Me(`queue`),style:{fontSize:`.72rem`,padding:`2px 10px`},children:[(0,s.jsx)(`i`,{className:`bi bi-bookmark-star me-1`}),`Queue`,k.length>0?` (${k.length})`:``]}),(0,s.jsxs)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${A===`wishlist`?` active`:``}`,onClick:()=>Me(`wishlist`),style:{fontSize:`.72rem`,padding:`2px 10px`},children:[(0,s.jsx)(`i`,{className:`bi bi-star me-1`}),`Wishlist`,e.length>0?` (${e.length})`:``]})]}),A===`queue`&&k.length>0&&(0,s.jsx)(`span`,{className:`badge`,style:{background:`#21262d`,color:`#8b949e`,fontSize:`.68rem`},children:`auto-pick order`})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,maxHeight:240},children:A===`queue`?k.length===0?(0,s.jsxs)(`div`,{className:`text-center`,style:{color:`#6c7892`,fontSize:`.76rem`,padding:`14px 16px`,lineHeight:1.5},children:[`Tap `,(0,s.jsx)(`i`,{className:`bi bi-bookmark-plus`}),` on players to line up your picks. When it's your turn just hit `,(0,s.jsx)(`strong`,{children:`Pick`}),` here — and if your timer runs out, the top available player in this list is auto-drafted.`]}):(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:k.map((e,t)=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{style:{color:`#6c7892`,width:22},children:t+1}),(0,s.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,s.jsxs)(`td`,{className:`text-end`,style:{width:96,whiteSpace:`nowrap`},children:[(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,disabled:!K,onClick:()=>K&&q(e.player_id),style:{fontSize:`.68rem`},children:`Pick`}),(0,s.jsx)(`button`,{className:`btn btn-link p-0 ms-2`,onClick:()=>W(e.player_id),title:`Remove`,style:{color:`#f85149`,fontSize:`.8rem`},children:(0,s.jsx)(`i`,{className:`bi bi-x-lg`})})]})]},e.player_id))})}):e.length===0?(0,s.jsx)(`div`,{className:`text-center`,style:{color:`#6c7892`,fontSize:`.76rem`,padding:`14px 16px`,lineHeight:1.5},children:`Star players (★) anywhere in the app to build your wishlist — the available ones show here, ready to queue or draft.`}):(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:e.map(e=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{className:`player-name`,children:e.name}),(0,s.jsx)(`td`,{style:{width:48},children:e.position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.position)}`,children:e.position.split(`/`)[0]})}),(0,s.jsxs)(`td`,{className:`text-end`,style:{width:110,whiteSpace:`nowrap`},children:[(0,s.jsx)(`button`,{className:`btn btn-sm py-0 px-2 ${j.has(e.id)?`btn-warning`:`btn-outline-secondary`}`,onClick:()=>j.has(e.id)?W(e.id):Ve(e.id),title:j.has(e.id)?`Queued`:`Add to queue`,style:{fontSize:`.68rem`},children:(0,s.jsx)(`i`,{className:`bi ${j.has(e.id)?`bi-bookmark-check-fill`:`bi-bookmark-plus`}`})}),(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2 ms-1`,disabled:!K,onClick:()=>K&&q(e.id),style:{fontSize:`.68rem`},children:`Pick`})]})]},e.id))})})})]})})(),(0,s.jsxs)(`div`,{className:`card`,style:{flex:3},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-clock-history me-2`,style:{color:`#8b949e`}}),`Pick History`]}),Y&&(0,s.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${C===`all`?` active`:``}`,onClick:()=>De(`all`),style:{fontSize:`.7rem`,padding:`2px 8px`},children:`All`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${C===`mine`?` active`:``}`,onClick:()=>De(`mine`),style:{fontSize:`.7rem`,padding:`2px 8px`},children:`Mine`})]})]}),(0,s.jsxs)(`span`,{className:`badge`,style:{background:`#21262d`,color:`#8b949e`,fontSize:`.75rem`},children:[d.picks_made,`/`,d.total_picks]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(0,s.jsxs)(`table`,{className:`table table-sm mb-0`,children:[(0,s.jsx)(`thead`,{className:`sticky-top`,children:(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`th`,{children:`#`}),(0,s.jsx)(`th`,{children:`Rd`}),(0,s.jsx)(`th`,{children:`Team`}),(0,s.jsx)(`th`,{children:`Player`}),(0,s.jsx)(`th`,{children:`Pos`}),(0,s.jsx)(`th`,{children:`AFL`})]})}),(0,s.jsx)(`tbody`,{children:mt.map(e=>(0,s.jsxs)(`tr`,{className:Y&&e.team_id===Y.id?`draft-pick-row-mine`:void 0,children:[(0,s.jsx)(`td`,{style:{color:`#6c7892`},children:e.pick_number}),(0,s.jsx)(`td`,{style:{color:`#6c7892`},children:e.round}),(0,s.jsx)(`td`,{children:e.team_name}),e.is_pass?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`td`,{children:(0,s.jsx)(`span`,{className:`draft-pass-tag`,children:`PASS`})}),(0,s.jsx)(`td`,{}),(0,s.jsx)(`td`,{})]}):(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)(`td`,{className:`player-name`,children:[e.player_name,e.is_auto_pick&&(0,s.jsx)(`span`,{className:`draft-auto-tag`,children:` (auto)`})]}),(0,s.jsx)(`td`,{children:e.player_position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#97a3ba`},children:e.player_afl_team})]})]},e.pick_number))})]})})]}),Y&&(0,s.jsxs)(`div`,{className:`card`,style:{flex:2},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-person-badge me-2`,style:{color:`#58a6ff`}}),Y.name]}),(0,s.jsxs)(`span`,{className:`badge`,style:{background:`#21262d`,color:`#8b949e`,fontSize:`.75rem`},children:[he.length,` players`]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(()=>{let e={DEF:[],MID:[],RUC:[],FWD:[],OTHER:[]};return he.forEach(t=>{let n=(t.player_position||``).split(`/`)[0].toUpperCase();n===`DEF`||n===`MID`||n===`RUC`||n===`FWD`?e[n].push(t):e.OTHER.push(t)}),[`DEF`,`MID`,`RUC`,`FWD`,`OTHER`].map(t=>e[t].length===0?null:(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`draft-yt-section ${t===`OTHER`?``:t.toLowerCase()}`,children:[t,` · `,e[t].length]}),(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:e[t].map(e=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{style:{color:`#6c7892`,width:30},children:e.pick_number}),(0,s.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,s.jsx)(`td`,{style:{width:50},children:e.player_position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${c(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#97a3ba`,width:60},children:e.player_afl_team})]},e.pick_number))})})]},t))})()})]}),(0,s.jsxs)(`div`,{className:`card draft-chat-card`,children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,style:{cursor:`pointer`},onClick:$e,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-chat-dots me-2`,style:{color:`#d29922`}}),`Draft Chat`]}),(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[Ie>0&&(0,s.jsx)(`span`,{className:`badge`,style:{background:`#f85149`,fontSize:`.6rem`,borderRadius:8},children:Ie}),(0,s.jsx)(`i`,{className:`bi bi-chevron-down${M?``:` chat-toggle-collapsed`}`,style:{color:`#8b949e`,fontSize:`.75rem`,transition:`transform .2s`}})]})]}),M&&(0,s.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`},children:[(0,s.jsx)(`div`,{ref:I,id:`chat-messages`,className:`card-body p-0`,style:{overflowY:`auto`,padding:`.5rem !important`,maxHeight:180},children:N.length===0?(0,s.jsx)(`div`,{className:`text-center py-3`,style:{color:`#484f58`,fontSize:`.75rem`},children:(0,s.jsx)(`i`,{className:`bi bi-chat-dots`,style:{fontSize:`1.2rem`}})}):N.map((e,t)=>e.is_system?(0,s.jsx)(`div`,{className:`chat-msg-system`,children:e.message},t):(0,s.jsxs)(`div`,{className:`chat-msg`,children:[(0,s.jsx)(`span`,{className:`chat-msg-name`,style:{color:Ze(e.team_name)},children:e.team_name}),(0,s.jsx)(`span`,{className:`chat-msg-text`,children:e.message})]},t))}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid rgba(110,130,180,.12)`,padding:`8px 12px`,display:`flex`,gap:6},children:[(0,s.jsx)(`input`,{type:`text`,className:`draft-filter-input flex-grow-1`,placeholder:`Say something...`,maxLength:500,value:F,onChange:e=>Fe(e.target.value),onKeyDown:e=>{e.key===`Enter`&&(e.preventDefault(),Qe())}}),(0,s.jsx)(`button`,{className:`btn btn-sm btn-primary`,onClick:Qe,style:{padding:`4px 12px`,whiteSpace:`nowrap`},children:(0,s.jsx)(`i`,{className:`bi bi-send`})})]})]})]})]})})]}),w!=null&&Q&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>T(null),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#161b22`,border:`1px solid #30363d`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Confirm Pick`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>T(null)})]}),(0,s.jsxs)(`div`,{className:`text-center`,style:{padding:`1rem`},children:[(0,s.jsx)(`div`,{style:{fontSize:`1.1rem`,fontWeight:700,color:`#c9d1d9`},children:Q.name}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-center gap-2 mt-1`,children:[(0,s.jsx)(`span`,{className:`pos-badge badge-${c(Q.position)}`,children:Q.position}),(0,s.jsx)(`span`,{style:{fontSize:`.8rem`,color:`#8b949e`},children:Q.afl_team})]})]}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>T(null),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-primary btn-sm flex-fill`,onClick:Ye,children:`Confirm`})]})]})]}),Oe&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>E(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#161b22`,border:`1px solid #30363d`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Pass Pick?`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>E(!1)})]}),(0,s.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,s.jsx)(`div`,{style:{fontSize:`.85rem`,color:`#8b949e`},children:`Are you sure you want to pass on this pick? You won't draft a player this round.`})}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>E(!1),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-warning btn-sm flex-fill`,onClick:Xe,children:`Pass`})]})]})]}),ke&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>D(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#161b22`,border:`1px solid #30363d`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`,color:`#f85149`},children:`End Draft Early?`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>D(!1)})]}),(0,s.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,s.jsxs)(`div`,{style:{fontSize:`.85rem`,color:`#8b949e`},children:[`All remaining picks will be marked as `,(0,s.jsx)(`strong`,{style:{color:`#d29922`},children:`PASS`}),` and the draft will be completed immediately.`]})}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>D(!1),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-danger btn-sm flex-fill`,onClick:lt,children:`End Draft`})]})]})]})]})}var u=class extends o.Component{state={error:null};static getDerivedStateFromError(e){return{error:e}}componentDidCatch(e,t){console.error(`Draft room crash:`,e,t)}render(){return this.state.error?(0,s.jsx)(`div`,{className:`card mt-4`,children:(0,s.jsxs)(`div`,{className:`card-body`,children:[(0,s.jsxs)(`h5`,{style:{color:`#f85149`},children:[(0,s.jsx)(`i`,{className:`bi bi-exclamation-triangle me-2`}),`Draft room hit an error`]}),(0,s.jsx)(`p`,{style:{fontSize:`.85rem`,color:`#8b949e`},children:`The draft data still loaded — this is a display glitch, not lost picks. Reload to try again.`}),(0,s.jsxs)(`pre`,{style:{fontSize:`.72rem`,color:`#8b949e`,whiteSpace:`pre-wrap`,maxHeight:220,overflow:`auto`},children:[this.state.error.message,`
`,this.state.error.stack]}),(0,s.jsx)(`button`,{className:`btn btn-sm btn-outline-primary mt-2`,onClick:()=>window.location.reload(),children:`Reload`})]})}):this.props.children}};function ue(){return(0,s.jsx)(u,{children:(0,s.jsx)(l,{})})}export{ue as DraftRoomPage};