import{d as e,m as t,r as n,t as r,u as i,y as a}from"./jsx-runtime-mCRDCYrZ.js";import{n as ee}from"./api-BFFY-yxh.js";import{t as te}from"./useSocket-DrrZyA6u.js";var o=a(t(),1),s=r();function ne(){return(0,s.jsxs)(`div`,{className:`drsk`,children:[(0,s.jsxs)(`div`,{className:`drsk-clock`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-timer`}),(0,s.jsx)(`span`,{className:`kl-skel drsk-onclock`})]}),(0,s.jsxs)(`div`,{className:`drsk-cols`,children:[(0,s.jsxs)(`div`,{className:`drsk-col drsk-col-list`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-filter`}),Array.from({length:14}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-row`},t))]}),(0,s.jsxs)(`div`,{className:`drsk-col drsk-col-board`,children:[(0,s.jsx)(`span`,{className:`kl-skel drsk-board-head`}),Array.from({length:6}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-board-row`},t))]})]}),(0,s.jsx)(`div`,{className:`drsk-history`,children:Array.from({length:8}).map((e,t)=>(0,s.jsx)(`span`,{className:`kl-skel drsk-pick`},t))})]})}var c=[{key:`sc_average`,label:`SC Avg`},{key:`age_factor`,label:`Longevity`},{key:`positional_scarcity`,label:`Scarcity`},{key:`trajectory`,label:`Trajectory`},{key:`durability`,label:`Durability`},{key:`rating_potential`,label:`Growth`}],re=[`#82b3e4`,`#7dc99a`,`#c2932f`,`#e07a6c`,`#b39ed4`,`#7ec0d3`,`#d68a7e`,`#f0d27a`],ie=`
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
`;function ae(e){if(e<=0)return`Starting soon...`;let t=Math.floor(e/1e3),n=Math.floor(t/86400),r=Math.floor(t%86400/3600),i=Math.floor(t%3600/60),a=t%60;return n>0?`${n}d ${r}h ${i}m`:r>0?`${r}h ${i}m ${a}s`:i>0?`${i}m ${a}s`:`${a}s`}function l(e){return e?e.split(`/`)[0].toLowerCase():`mid`}function oe(e){return e==null?`tier-empty`:e>=80?`tier-elite`:e>=70?`tier-good`:e>=60?`tier-ok`:`tier-low`}function se(e){return e==null?`tier-empty`:e>=80?`tier-elite`:e>=70?`tier-good`:e>=60?`tier-ok`:`tier-low`}function u(){let{leagueId:t}=e(),r=i(),[a,u]=(0,o.useState)(null),[ce,d]=(0,o.useState)(!0),[f,p]=(0,o.useState)(null),[m,h]=(0,o.useState)([]),[g,le]=(0,o.useState)(null),[ue,de]=(0,o.useState)([]),[_,fe]=(0,o.useState)(``),[v,pe]=(0,o.useState)(``),[y,me]=(0,o.useState)(``),[b,he]=(0,o.useState)(``),[x,ge]=(0,o.useState)(`draft_score`),[S,C]=(0,o.useState)(`desc`),[w,T]=(0,o.useState)({}),[_e,ve]=(0,o.useState)(!1),[ye,be]=(0,o.useState)(!1),[E,D]=(0,o.useState)(`all`),[O,k]=(0,o.useState)(null),[xe,A]=(0,o.useState)(!1),[Se,j]=(0,o.useState)(!1),[M,Ce]=(0,o.useState)(!1),[N,we]=(0,o.useState)(()=>typeof window<`u`&&window.innerWidth>=992),[P,F]=(0,o.useState)([]),[I,L]=(0,o.useState)(``),[R,Te]=(0,o.useState)(0),z=(0,o.useRef)(null),B=(0,o.useRef)({}),[Ee,V]=(0,o.useState)(``),[De,Oe]=(0,o.useState)(``),H=(0,o.useRef)(null);(0,o.useEffect)(()=>{d(!0),ee(`/leagues/${t}/draft?format=json`).then(e=>{u(e),p(e.state),T(e.user_weights),be(e.has_custom_weights),e.session.scheduled_start&&V(e.session.scheduled_start.slice(0,16))}).catch(()=>{}).finally(()=>d(!1))},[t]),(0,o.useEffect)(()=>{H.current&&window.clearInterval(H.current);let e=a?.session.scheduled_start;if(!e||f?.status!==`scheduled`){Oe(e?``:`No time set`);return}let t=()=>{Oe(ae(new Date(e).getTime()-Date.now()))};return t(),H.current=window.setInterval(t,1e3),()=>{H.current&&window.clearInterval(H.current)}},[a?.session.scheduled_start,f?.status]);let U=(0,o.useCallback)(()=>{a?.user_team&&fetch(`/leagues/${t}/draft/api/position_needs`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>{e.error||le(e)}).catch(()=>{})},[t,a?.user_team]),W=(0,o.useCallback)(()=>{a?.user_team&&fetch(`/leagues/${t}/draft/api/team_picks/${a.user_team.id}`,{credentials:`same-origin`}).then(e=>e.json()).then(de).catch(()=>{})},[t,a?.user_team]),G=(0,o.useCallback)(()=>{let e=c.map(e=>`w_${e.key}=${w[e.key]??.2}`).join(`&`),n=b?800:200,r=new URLSearchParams;r.set(`q`,_),v&&r.set(`pos`,v),r.set(`limit`,String(n)),fetch(`/leagues/${t}/draft/api/available?${r.toString()}&${e}`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>h(e)).catch(()=>h([]))},[t,_,v,b,w]);(0,o.useEffect)(()=>{a&&G()},[a,G]),(0,o.useEffect)(()=>{a&&(U(),W())},[a,U,W]),(0,o.useEffect)(()=>{a&&fetch(`/leagues/${t}/draft/api/chat_history`,{credentials:`same-origin`}).then(e=>e.json()).then(e=>F(e)).catch(()=>{})},[t,a]),(0,o.useEffect)(()=>{z.current&&(z.current.scrollTop=z.current.scrollHeight)},[P,N]);let{socket:K,state:ke}=te({namespace:`/draft`,onConnect:e=>e.emit(`join_draft`,{league_id:Number(t)}),events:{draft_state:e=>{p(e),U(),W(),G()},pick_made:e=>{let t=e;p(e=>e&&{...e,pick_history:[t,...e.pick_history],picks_made:e.picks_made+1,picked_player_ids:t.player_id?[...e.picked_player_ids,t.player_id]:e.picked_player_ids}),F(e=>[...e,{team_name:t.team_name,message:t.is_pass?`${t.team_name} passed`:`${t.team_name} drafted ${t.player_name}`,is_system:!0}]),U(),G(),t.team_id===a?.user_team?.id&&W()},timer_tick:e=>{let{remaining:t}=e;p(e=>e&&{...e,timer_remaining:t})},draft_completed:e=>{p({...e,status:`completed`})},draft_chat_msg:e=>{let t=e;F(e=>[...e,t]),N||Te(e=>e+1)},schedule_updated:e=>{let{scheduled_start:t}=e;u(e=>e&&{...e,session:{...e.session,scheduled_start:t}}),t&&V(t.slice(0,16))},error:e=>alert(e.message)}}),Ae=(0,o.useMemo)(()=>{let e=m.filter(e=>!(f&&e.id!=null&&f.picked_player_ids.includes(e.id)));y&&(e=e.filter(e=>e.age==null?!1:y===`30+`?e.age>=30:y===`25-30`?e.age>=25&&e.age<=30:e.age<parseInt(y))),b&&(e=e.filter(e=>e.afl_team===b));let t=S===`asc`?1:-1;return e.slice().sort((e,n)=>{let r=e[x],i=n[x];return r==null&&i==null?0:r==null?1:i==null?-1:typeof r==`string`&&typeof i==`string`?t*r.localeCompare(i):t*(r-i)}).slice(0,100)},[m,y,b,x,S,f]),je=(0,o.useMemo)(()=>{let e=new Set;return m.forEach(t=>{t.afl_team&&e.add(t.afl_team)}),[...e].sort()},[m]),Me=e=>{x===e?C(e=>e===`desc`?`asc`:`desc`):(ge(e),C([`name`,`position`,`afl_team`].includes(e)?`asc`:`desc`))},Ne=e=>x===e?S===`desc`?`bi-chevron-down`:`bi-chevron-up`:`bi-chevron-expand`,Pe=!!(a?.user_team&&f?.current_team_id===a.user_team.id),Fe=f?.status===`in_progress`&&(Pe||a?.is_commissioner&&M);function Ie(e){return!g||!g.blocked_positions.length||!e?!1:e.split(`/`).map(e=>e.trim().toUpperCase()).every(e=>g.blocked_positions.includes(e))}function Le(e){if(!K?.connected){alert(`Not connected — refresh the page.`);return}k(e)}function Re(){O==null||!K||(K.emit(`make_pick`,{league_id:Number(t),player_id:O}),k(null))}function ze(){K?.emit(`pass_pick`,{league_id:Number(t)}),A(!1)}function Be(e){if(!B.current[e]){let t=Object.keys(B.current).length;B.current[e]=re[t%re.length]}return B.current[e]}function Ve(){!I.trim()||!K||(K.emit(`draft_chat`,{league_id:Number(t),message:I.trim()}),L(``))}function He(){let e=!N;we(e),e&&Te(0)}function Ue(e,t){T(n=>({...n,[e]:t}))}function We(){G()}async function Ge(){try{let e=await(await fetch(`/leagues/${t}/draft/api/save_weights`,{method:`POST`,credentials:`same-origin`,headers:{"Content-Type":`application/json`},body:JSON.stringify(w)})).json();e.status===`ok`&&(e.weights&&T(e.weights),be(!0),G())}catch{}}function Ke(){K?.emit(`update_schedule`,{league_id:Number(t),scheduled_start:Ee||null})}function qe(){K?.emit(`start_draft`,{league_id:Number(t)})}function Je(){confirm(`Pause the draft? All timers will stop.`)&&K?.emit(`pause_draft`,{league_id:Number(t)})}function Ye(){K?.emit(`resume_draft`,{league_id:Number(t)})}function Xe(){confirm(`Undo the last pick?`)&&K?.emit(`undo_pick`,{league_id:Number(t)})}function Ze(){if(!confirm(`Are you sure you want to restart the draft?

This will DELETE the current draft session, remove all drafted players from rosters, and take you to settings where you can make changes before re-drafting.

This cannot be undone.`))return;let e=new FormData;e.set(`action`,`restart_draft`),fetch(`/leagues/${t}/draft/setup`,{method:`POST`,body:e,credentials:`same-origin`}).then(()=>r(`/leagues/${t}/settings`))}async function Qe(){let e=new FormData;try{await fetch(`/leagues/${t}/draft/api/end`,{method:`POST`,body:e,credentials:`same-origin`}),j(!1)}catch{}}if(ce)return(0,s.jsx)(ne,{});if(!a||!f)return(0,s.jsx)(`p`,{className:`text-danger`,children:`Failed to load draft room`});let{league:q,user_team:J,is_commissioner:Y,can_restart:$e,session:X}=a,Z=X.scheduled_start?new Date(X.scheduled_start):null,et=Z?Z.toLocaleDateString(`en-AU`,{weekday:`short`,day:`numeric`,month:`short`})+`, `+Z.toLocaleTimeString(`en-AU`,{hour:`numeric`,minute:`2-digit`}):``,Q=O==null?null:m.find(e=>e.id===O),tt=Pe&&f.status===`in_progress`,$=f.status===`completed`,nt=E===`mine`&&J?f.pick_history.filter(e=>e.team_name===J.name):f.pick_history;return(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`style`,{children:ie}),(0,s.jsxs)(`div`,{className:`page-header`,children:[(0,s.jsxs)(`div`,{className:`page-breadcrumb`,children:[(0,s.jsx)(n,{to:`/leagues/${t}`,children:q.name}),` / Draft Room`]}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-start flex-wrap gap-2`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h2`,{className:`mb-0`,children:`Live Draft`}),(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3 mt-1`,children:[(0,s.jsx)(`span`,{className:`conn-dot${ke===`connected`?``:` off`}`,title:ke===`connected`?`Connected`:`Disconnected`}),(0,s.jsx)(`span`,{className:`status-pill status-${f.status.replace(`_`,`-`)}`,children:f.status}),(0,s.jsxs)(`span`,{className:`draft-header-info`,children:[q.draft_type.charAt(0).toUpperCase()+q.draft_type.slice(1),` · `,X.pick_timer_secs,`s timer`]})]})]}),Y&&(0,s.jsxs)(`div`,{className:`d-flex gap-2 align-items-center flex-wrap`,children:[(0,s.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm${M?` active`:``}`,onClick:()=>Ce(e=>!e),style:{fontSize:`.7rem`},title:`Pick on behalf of other teams`,children:[(0,s.jsx)(`i`,{className:`bi bi-shield${M?`-fill-check`:``} me-1`}),M?`Override ON`:`Override`]}),f.status===`scheduled`&&(0,s.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:qe,children:[(0,s.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Start Draft`]}),f.status===`in_progress`&&(0,s.jsxs)(`button`,{className:`btn btn-outline-secondary btn-sm`,onClick:Je,children:[(0,s.jsx)(`i`,{className:`bi bi-pause-fill me-1`}),`Pause`]}),f.status===`paused`&&(0,s.jsxs)(`button`,{className:`btn btn-primary btn-sm`,onClick:Ye,children:[(0,s.jsx)(`i`,{className:`bi bi-play-fill me-1`}),`Resume`]}),f.picks_made>0&&(f.status===`in_progress`||f.status===`paused`)&&(0,s.jsxs)(`button`,{className:`btn btn-outline-info btn-sm`,onClick:Xe,style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Undo`]}),(f.status===`in_progress`||f.status===`paused`)&&(0,s.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:()=>j(!0),style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-stop-fill me-1`}),`End Draft`]}),$e&&(0,s.jsxs)(`button`,{className:`btn btn-outline-danger btn-sm`,onClick:Ze,style:{fontSize:`.7rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-arrow-counterclockwise me-1`}),`Restart`]})]})]})]}),f.status===`scheduled`?(0,s.jsxs)(`div`,{className:`draft-event`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,s.jsx)(`div`,{className:`draft-pick-badge scheduled`,children:(0,s.jsx)(`i`,{className:`bi bi-hourglass-split`})}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`div`,{className:`draft-banner-round`,children:`Draft Starts In`}),(0,s.jsx)(`div`,{className:`draft-event-countdown${De===`Starting soon...`?` soon`:``}`,children:De}),et&&(0,s.jsx)(`div`,{className:`draft-event-time`,children:et})]})]}),Y&&(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,s.jsx)(`input`,{type:`datetime-local`,className:`draft-filter-input`,value:Ee,onChange:e=>V(e.target.value),style:{width:`auto`}}),(0,s.jsxs)(`button`,{className:`btn btn-outline-warning btn-sm`,onClick:Ke,style:{fontSize:`.7rem`,whiteSpace:`nowrap`},children:[(0,s.jsx)(`i`,{className:`bi bi-clock me-1`}),`Set Time`]})]})]}):(0,s.jsxs)(`div`,{className:`draft-banner${tt?` draft-banner-your-pick`:``}${$?` draft-banner-complete`:``}`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-3`,children:[(0,s.jsx)(`div`,{className:`draft-pick-badge`,children:(0,s.jsx)(`span`,{children:f.current_pick||`-`})}),(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`draft-banner-round`,children:[`Round `,f.current_round||`-`]}),(0,s.jsxs)(`div`,{className:`draft-banner-team`,children:[$?`Draft Complete`:f.current_team_name||`TBD`,tt&&(0,s.jsx)(`span`,{className:`draft-your-pick-pill`,children:`Your Pick`})]})]})]}),(0,s.jsxs)(`div`,{className:`draft-timer-block`,children:[(0,s.jsx)(`span`,{className:`draft-timer${(f.timer_remaining??0)<=10&&f.timer_remaining!=null?` timer-urgent`:``}`,children:$?`-`:f.timer_remaining??X.pick_timer_secs}),(0,s.jsx)(`span`,{className:`draft-timer-label`,children:`seconds`})]})]}),(0,s.jsxs)(`div`,{className:`row g-3`,children:[(0,s.jsx)(`div`,{className:`col-lg-7`,children:(0,s.jsxs)(`div`,{className:`card`,style:{display:`flex`,flexDirection:`column`},children:[(0,s.jsxs)(`div`,{className:`card-header`,children:[(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center mb-2`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-people me-2`,style:{color:`#8b949e`}}),`Available Players`]}),(0,s.jsxs)(`div`,{className:`d-flex gap-1 align-items-center`,children:[f.status===`in_progress`&&(0,s.jsxs)(`button`,{className:`btn btn-outline-warning py-0 px-2`,onClick:()=>A(!0),style:{fontSize:`.7rem`},title:`Pass on this pick`,children:[(0,s.jsx)(`i`,{className:`bi bi-skip-forward me-1`}),`Pass`]}),(0,s.jsxs)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,type:`button`,onClick:()=>ve(e=>!e),style:{fontSize:`.7rem`},title:`Adjust your draft value weights`,children:[(0,s.jsx)(`i`,{className:`bi bi-sliders me-1`}),`Values`]})]})]}),_e&&(0,s.jsxs)(`div`,{className:`draft-values-panel`,children:[c.map(({key:e,label:t})=>(0,s.jsxs)(`div`,{className:`draft-values-row`,children:[(0,s.jsx)(`span`,{className:`draft-values-label`,children:t}),(0,s.jsx)(`input`,{type:`range`,className:`draft-slider`,min:0,max:1,step:.01,value:w[e]??.2,onChange:t=>Ue(e,parseFloat(t.target.value))}),(0,s.jsxs)(`span`,{className:`draft-values-value`,children:[Math.round((w[e]??.2)*100),`%`]})]},e)),(0,s.jsxs)(`div`,{className:`draft-values-foot`,children:[(0,s.jsx)(`span`,{className:`draft-values-foot-meta`,children:ye?(0,s.jsx)(`span`,{className:`custom`,children:`Custom`}):`League defaults`}),(0,s.jsxs)(`div`,{className:`d-flex gap-1`,children:[(0,s.jsx)(`button`,{className:`btn btn-outline-secondary py-0 px-2`,onClick:We,style:{fontSize:`.7rem`},children:`Apply`}),(0,s.jsx)(`button`,{className:`btn btn-primary py-0 px-2`,onClick:Ge,style:{fontSize:`.7rem`},children:`Save`})]})]})]}),g&&J&&(0,s.jsxs)(`div`,{className:`d-flex gap-2 mb-2 flex-wrap`,children:[[`DEF`,`MID`,`FWD`,`RUC`].map(e=>{let t=g.drafted[e]??0,n=g.required[e]??0,r=g.needs[e]??0,i=g.blocked_positions.includes(e);return(0,s.jsxs)(`span`,{className:`draft-need-chip ${i?`blocked`:r>0?`short`:`met`}`,title:i?`BLOCKED`:r>0?`${r} more needed`:`Requirement met`,children:[e,` `,t,`/`,n,i&&(0,s.jsx)(`i`,{className:`bi bi-lock-fill`,style:{fontSize:`.6rem`}})]},e)}),(0,s.jsxs)(`span`,{className:`draft-need-chip north`,title:`North Melbourne players drafted`,children:[`NM `,g.north_count??0]})]}),(0,s.jsxs)(`div`,{className:`row g-2`,children:[(0,s.jsx)(`div`,{className:`col`,children:(0,s.jsx)(`input`,{type:`text`,className:`draft-filter-input w-100`,placeholder:`Search players...`,value:_,onChange:e=>fe(e.target.value)})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:v,onChange:e=>pe(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Pos`}),(0,s.jsx)(`option`,{value:`DEF`,children:`DEF`}),(0,s.jsx)(`option`,{value:`MID`,children:`MID`}),(0,s.jsx)(`option`,{value:`FWD`,children:`FWD`}),(0,s.jsx)(`option`,{value:`RUC`,children:`RUC`})]})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:y,onChange:e=>me(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Ages`}),(0,s.jsx)(`option`,{value:`21`,children:`U21`}),(0,s.jsx)(`option`,{value:`23`,children:`U23`}),(0,s.jsx)(`option`,{value:`25`,children:`U25`}),(0,s.jsx)(`option`,{value:`25-30`,children:`25-30`}),(0,s.jsx)(`option`,{value:`30+`,children:`30+`})]})}),(0,s.jsx)(`div`,{className:`col-auto`,children:(0,s.jsxs)(`select`,{className:`draft-filter-select`,value:b,onChange:e=>he(e.target.value),style:{width:`auto`},children:[(0,s.jsx)(`option`,{value:``,children:`All Clubs`}),je.map(e=>(0,s.jsx)(`option`,{value:e,children:e},e))]})})]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`,overflowX:`auto`,maxHeight:`70vh`},children:(0,s.jsxs)(`table`,{className:`table table-sm mb-0 draft-avail-tbl`,children:[(0,s.jsx)(`thead`,{children:(0,s.jsxs)(`tr`,{children:[[[`name`,`Player`],[`position`,`Pos`],[`afl_team`,`Team`],[`age`,`Age`],[`sc_avg`,`SC`],[`rating`,`Rtg`],[`potential`,`Pot`],[`draft_score`,`Value`]].map(([e,t])=>(0,s.jsxs)(`th`,{className:`sortable-th${x===e?` active-sort`:``}`,onClick:()=>Me(e),children:[t,` `,(0,s.jsx)(`i`,{className:`bi sort-icon ${Ne(e)}`})]},e)),(0,s.jsx)(`th`,{})]})}),(0,s.jsx)(`tbody`,{children:Ae.map(e=>{let t=Ie(e.position);return(0,s.jsxs)(`tr`,{className:t?`blocked`:void 0,children:[(0,s.jsx)(`td`,{className:`player-name`,children:e.name}),(0,s.jsx)(`td`,{children:e.position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${l(e.position)}`,children:e.position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#97a3ba`},children:e.afl_team||``}),(0,s.jsx)(`td`,{style:{color:`#6c7892`},children:e.age??`-`}),(0,s.jsx)(`td`,{className:`stat-cell`,style:{color:`#b6c0d3`},children:e.sc_avg==null?`-`:e.sc_avg.toFixed(1)}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip ${oe(e.rating)}`,children:e.rating??`–`})}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip ${se(e.potential)}`,children:e.potential??`–`})}),(0,s.jsx)(`td`,{className:`stat-cell`,children:(0,s.jsx)(`span`,{className:`draft-stat-chip draft-score`,children:e.draft_score==null?`–`:e.draft_score.toFixed(1)})}),(0,s.jsx)(`td`,{children:(0,s.jsx)(`button`,{className:`btn btn-outline-primary btn-sm py-0 px-2`,onClick:()=>Fe&&Le(e.id),disabled:!Fe,title:t?`Position blocked — draft other positions first`:``,style:{fontSize:`.7rem`},children:t?(0,s.jsx)(`i`,{className:`bi bi-lock-fill`}):`Pick`})})]},e.id)})})]})})]})}),(0,s.jsx)(`div`,{className:`col-lg-5`,children:(0,s.jsxs)(`div`,{className:`draft-right-col`,children:[(0,s.jsxs)(`div`,{className:`card`,style:{flex:3},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-clock-history me-2`,style:{color:`#8b949e`}}),`Pick History`]}),J&&(0,s.jsxs)(`div`,{className:`btn-group btn-group-sm`,role:`group`,children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${E===`all`?` active`:``}`,onClick:()=>D(`all`),style:{fontSize:`.7rem`,padding:`2px 8px`},children:`All`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-sm btn-outline-secondary${E===`mine`?` active`:``}`,onClick:()=>D(`mine`),style:{fontSize:`.7rem`,padding:`2px 8px`},children:`Mine`})]})]}),(0,s.jsxs)(`span`,{className:`badge`,style:{background:`#21262d`,color:`#8b949e`,fontSize:`.75rem`},children:[f.picks_made,`/`,f.total_picks]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(0,s.jsxs)(`table`,{className:`table table-sm mb-0`,children:[(0,s.jsx)(`thead`,{className:`sticky-top`,children:(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`th`,{children:`#`}),(0,s.jsx)(`th`,{children:`Rd`}),(0,s.jsx)(`th`,{children:`Team`}),(0,s.jsx)(`th`,{children:`Player`}),(0,s.jsx)(`th`,{children:`Pos`}),(0,s.jsx)(`th`,{children:`AFL`})]})}),(0,s.jsx)(`tbody`,{children:nt.map(e=>(0,s.jsxs)(`tr`,{className:J&&e.team_id===J.id?`draft-pick-row-mine`:void 0,children:[(0,s.jsx)(`td`,{style:{color:`#6c7892`},children:e.pick_number}),(0,s.jsx)(`td`,{style:{color:`#6c7892`},children:e.round}),(0,s.jsx)(`td`,{children:e.team_name}),e.is_pass?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`td`,{children:(0,s.jsx)(`span`,{className:`draft-pass-tag`,children:`PASS`})}),(0,s.jsx)(`td`,{}),(0,s.jsx)(`td`,{})]}):(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)(`td`,{className:`player-name`,children:[e.player_name,e.is_auto_pick&&(0,s.jsx)(`span`,{className:`draft-auto-tag`,children:` (auto)`})]}),(0,s.jsx)(`td`,{children:e.player_position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${l(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#97a3ba`},children:e.player_afl_team})]})]},e.pick_number))})]})})]}),J&&(0,s.jsxs)(`div`,{className:`card`,style:{flex:2},children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-person-badge me-2`,style:{color:`#58a6ff`}}),J.name]}),(0,s.jsxs)(`span`,{className:`badge`,style:{background:`#21262d`,color:`#8b949e`,fontSize:`.75rem`},children:[ue.length,` players`]})]}),(0,s.jsx)(`div`,{className:`card-body p-0`,style:{overflowY:`auto`},children:(()=>{let e={DEF:[],MID:[],RUC:[],FWD:[],OTHER:[]};return ue.forEach(t=>{let n=(t.player_position||``).split(`/`)[0].toUpperCase();n===`DEF`||n===`MID`||n===`RUC`||n===`FWD`?e[n].push(t):e.OTHER.push(t)}),[`DEF`,`MID`,`RUC`,`FWD`,`OTHER`].map(t=>e[t].length===0?null:(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`draft-yt-section ${t===`OTHER`?``:t.toLowerCase()}`,children:[t,` · `,e[t].length]}),(0,s.jsx)(`table`,{className:`table table-sm mb-0`,children:(0,s.jsx)(`tbody`,{children:e[t].map(e=>(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`td`,{style:{color:`#6c7892`,width:30},children:e.pick_number}),(0,s.jsx)(`td`,{className:`player-name`,children:e.player_name}),(0,s.jsx)(`td`,{style:{width:50},children:e.player_position&&(0,s.jsx)(`span`,{className:`draft-pos-chip ${l(e.player_position)}`,children:e.player_position.split(`/`)[0]})}),(0,s.jsx)(`td`,{style:{color:`#97a3ba`,width:60},children:e.player_afl_team})]},e.pick_number))})})]},t))})()})]}),(0,s.jsxs)(`div`,{className:`card draft-chat-card`,children:[(0,s.jsxs)(`div`,{className:`card-header d-flex justify-content-between align-items-center`,style:{cursor:`pointer`},onClick:He,children:[(0,s.jsxs)(`h5`,{className:`mb-0 fw-bold`,style:{fontSize:`.95rem`},children:[(0,s.jsx)(`i`,{className:`bi bi-chat-dots me-2`,style:{color:`#d29922`}}),`Draft Chat`]}),(0,s.jsxs)(`div`,{className:`d-flex align-items-center gap-2`,children:[R>0&&(0,s.jsx)(`span`,{className:`badge`,style:{background:`#f85149`,fontSize:`.6rem`,borderRadius:8},children:R}),(0,s.jsx)(`i`,{className:`bi bi-chevron-down${N?``:` chat-toggle-collapsed`}`,style:{color:`#8b949e`,fontSize:`.75rem`,transition:`transform .2s`}})]})]}),N&&(0,s.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`},children:[(0,s.jsx)(`div`,{ref:z,id:`chat-messages`,className:`card-body p-0`,style:{overflowY:`auto`,padding:`.5rem !important`,maxHeight:180},children:P.length===0?(0,s.jsx)(`div`,{className:`text-center py-3`,style:{color:`#484f58`,fontSize:`.75rem`},children:(0,s.jsx)(`i`,{className:`bi bi-chat-dots`,style:{fontSize:`1.2rem`}})}):P.map((e,t)=>e.is_system?(0,s.jsx)(`div`,{className:`chat-msg-system`,children:e.message},t):(0,s.jsxs)(`div`,{className:`chat-msg`,children:[(0,s.jsx)(`span`,{className:`chat-msg-name`,style:{color:Be(e.team_name)},children:e.team_name}),(0,s.jsx)(`span`,{className:`chat-msg-text`,children:e.message})]},t))}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid rgba(110,130,180,.12)`,padding:`8px 12px`,display:`flex`,gap:6},children:[(0,s.jsx)(`input`,{type:`text`,className:`draft-filter-input flex-grow-1`,placeholder:`Say something...`,maxLength:500,value:I,onChange:e=>L(e.target.value),onKeyDown:e=>{e.key===`Enter`&&(e.preventDefault(),Ve())}}),(0,s.jsx)(`button`,{className:`btn btn-sm btn-primary`,onClick:Ve,style:{padding:`4px 12px`,whiteSpace:`nowrap`},children:(0,s.jsx)(`i`,{className:`bi bi-send`})})]})]})]})]})})]}),O!=null&&Q&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>k(null),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#161b22`,border:`1px solid #30363d`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Confirm Pick`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>k(null)})]}),(0,s.jsxs)(`div`,{className:`text-center`,style:{padding:`1rem`},children:[(0,s.jsx)(`div`,{style:{fontSize:`1.1rem`,fontWeight:700,color:`#c9d1d9`},children:Q.name}),(0,s.jsxs)(`div`,{className:`d-flex justify-content-center gap-2 mt-1`,children:[(0,s.jsx)(`span`,{className:`pos-badge badge-${l(Q.position)}`,children:Q.position}),(0,s.jsx)(`span`,{style:{fontSize:`.8rem`,color:`#8b949e`},children:Q.afl_team})]})]}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>k(null),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-primary btn-sm flex-fill`,onClick:Re,children:`Confirm`})]})]})]}),xe&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>A(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#161b22`,border:`1px solid #30363d`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`},children:`Pass Pick?`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>A(!1)})]}),(0,s.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,s.jsx)(`div`,{style:{fontSize:`.85rem`,color:`#8b949e`},children:`Are you sure you want to pass on this pick? You won't draft a player this round.`})}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>A(!1),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-warning btn-sm flex-fill`,onClick:ze,children:`Pass`})]})]})]}),Se&&(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`div`,{onClick:()=>j(!1),style:{position:`fixed`,inset:0,background:`rgba(0,0,0,.55)`,zIndex:1055}}),(0,s.jsxs)(`div`,{role:`dialog`,"aria-modal":`true`,style:{position:`fixed`,top:`50%`,left:`50%`,transform:`translate(-50%,-50%)`,zIndex:1060,width:`90%`,maxWidth:360,background:`#161b22`,border:`1px solid #30363d`,borderRadius:12},children:[(0,s.jsxs)(`div`,{style:{borderBottom:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,justifyContent:`space-between`,alignItems:`center`},children:[(0,s.jsx)(`h6`,{className:`fw-bold mb-0`,style:{fontSize:`.9rem`,color:`#f85149`},children:`End Draft Early?`}),(0,s.jsx)(`button`,{type:`button`,className:`btn-close btn-close-white`,onClick:()=>j(!1)})]}),(0,s.jsx)(`div`,{className:`text-center`,style:{padding:`1rem`},children:(0,s.jsxs)(`div`,{style:{fontSize:`.85rem`,color:`#8b949e`},children:[`All remaining picks will be marked as `,(0,s.jsx)(`strong`,{style:{color:`#d29922`},children:`PASS`}),` and the draft will be completed immediately.`]})}),(0,s.jsxs)(`div`,{style:{borderTop:`1px solid #30363d`,padding:`.75rem 1rem`,display:`flex`,gap:`.5rem`},children:[(0,s.jsx)(`button`,{type:`button`,className:`btn btn-outline-secondary btn-sm flex-fill`,onClick:()=>j(!1),children:`Cancel`}),(0,s.jsx)(`button`,{type:`button`,className:`btn btn-danger btn-sm flex-fill`,onClick:Qe,children:`End Draft`})]})]})]})]})}export{u as DraftRoomPage};