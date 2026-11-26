import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";import{d as r,f as i,n as a}from"./chunk-QFMPRPBF-CEu2oS-5.js";import{t as o}from"./useFetch-GqHgoGmO.js";import{t as s}from"./TeamBadge-COcepeqQ.js";import{t as c}from"./LeagueSubnav-CR7NlH3u.js";var l=e(t(),1),u=n();function d(){return(0,u.jsxs)(`div`,{className:`fxsk`,children:[(0,u.jsx)(`div`,{className:`fxsk-header`,children:(0,u.jsx)(`span`,{className:`kl-skel fxsk-title`})}),(0,u.jsx)(`div`,{className:`fxsk-rounds`,children:Array.from({length:8}).map((e,t)=>(0,u.jsx)(`span`,{className:`kl-skel fxsk-round`},t))}),(0,u.jsx)(`div`,{className:`fxsk-list`,children:Array.from({length:5}).map((e,t)=>(0,u.jsxs)(`div`,{className:`fxsk-row`,children:[(0,u.jsx)(`span`,{className:`kl-skel fxsk-side`}),(0,u.jsx)(`span`,{className:`kl-skel fxsk-score`}),(0,u.jsx)(`span`,{className:`kl-skel fxsk-side`})]},t))})]})}var f=`
.rnd-strip { display:flex; align-items:stretch; background:#0e0d0f; border:1px solid #1e1d21; border-radius:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; margin-bottom:20px; }
.rnd-strip::-webkit-scrollbar { display:none; }
.rnd-item { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1 1 0; min-width:44px; padding:12px 2px 10px; text-decoration:none; border-right:1px solid #151518; transition:background .12s; position:relative; cursor:pointer; color:inherit; }
.rnd-item:last-child { border-right:none; }
.rnd-item:hover { background:#151518; }
.rnd-item.active { background:#151518; }
.rnd-item.active::after { content:''; position:absolute; bottom:0; left:20%; right:20%; height:2px; background:#ececf6; border-radius:1px 1px 0 0; box-shadow:0 0 6px rgba(236,236,246,.5); }
.rnd-num { font-size:.8125rem; font-weight:600; color:var(--kl-text-primary); line-height:1; transition:color .12s; }
.rnd-item:hover .rnd-num { color:var(--kl-text-primary); }
.rnd-item.active .rnd-num { color:#ebebee; }
.rnd-item.rnd-done .rnd-num { color:var(--kl-text-primary); }
.rnd-item.rnd-live .rnd-num { color:#3fb950; }
.rnd-dot { width:5px; height:5px; border-radius:50%; margin-top:4px; }
.rnd-dot-done { background:#63616d; }
.rnd-dot-live { background:#3fb950; animation:livePulse 1.8s ease-in-out infinite; }
.rnd-dot-part { background:#9e6a03; }
.rnd-dot-none { background:transparent; }
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.4);} }
.round-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #1e1d21; }
.round-hdr-left { display:flex; align-items:baseline; gap:10px; }
.round-hdr h3 { font-size:1.05rem; font-weight:700; color:#ebebee; margin:0; letter-spacing:-.01em; }
.round-hdr .rh-badge { font-size:.8125rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
.rh-complete { background:rgba(46,160,67,.1); color:#2ea043; }
.rh-live { background:rgba(63,185,80,.12); color:#3fb950; }
.rh-progress { background:rgba(158,106,3,.1); color:#d29922; }
.rh-actions { display:flex; gap:6px; align-items:center; }
.rh-btn { font-size:.8125rem; padding:4px 10px; border-radius:6px; border:1px solid #2a292f; background:transparent; color:var(--kl-text-primary); text-decoration:none; transition:all .12s; cursor:pointer; }
.rh-btn:hover { border-color:#63616d; color:var(--kl-text-primary); }
.rh-btn-primary { border-color:rgba(236,236,246,.3); color:#ececf6; }
.rh-btn-primary:hover { border-color:#ececf6; background:rgba(236,236,246,.06); }
.mx-list { background:#0e0d0f; border:1px solid #1e1d21; border-radius:10px; overflow:hidden; }
.mx-row { display:grid; grid-template-columns:1fr auto 1fr auto; align-items:center; padding:14px 20px; gap:0; border-bottom:1px solid #151518; transition:background .1s; text-decoration:none; color:inherit; cursor:pointer; }
.mx-row:last-child { border-bottom:none; }
.mx-row:hover { background:rgba(21,21,24,.6); }
.mx-team { font-size:.85rem; font-weight:500; color:var(--kl-text-primary); text-decoration:none; transition:color .1s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mx-team:hover { color:#ececf6; }
.mx-team-home { text-align:left; padding-right:12px; }
.mx-team-away { text-align:right; padding-left:12px; }
.mx-team.won { color:#ebebee; font-weight:700; }
.mx-centre { display:flex; align-items:center; justify-content:center; min-width:100px; gap:0; }
.mx-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.mx-sc.won { color:#3fb950; }
.mx-sc.lost { color:var(--kl-text-primary); }
.mx-sc.draw { color:var(--kl-text-primary); }
.mx-sep { color:#ffffff; margin:0 4px; font-weight:300; font-size:.8125rem; }
.mx-vs { font-size:.8125rem; font-weight:600; color:#ffffff; }
.mx-live-tag { font-size:.8125rem; font-weight:700; color:#3fb950; letter-spacing:.5px; background:rgba(63,185,80,.08); padding:2px 6px; border-radius:3px; }
.mx-arrow { display:none; }
.mx-row:hover .mx-arrow { color:var(--kl-text-primary); }
.season-empty { text-align:center; padding:60px 20px; color:var(--kl-text-primary); }
.season-empty i { font-size:2rem; margin-bottom:12px; display:block; color:#2a292f; }
.season-empty h4 { color:var(--kl-text-primary); font-size:1rem; font-weight:600; margin-bottom:4px; }
.season-empty p { font-size:.8125rem; }
.season-empty a { color:#ececf6; }
`;function p(e){let t=e.toLowerCase();return t.includes(`supercoach`)?`sc`:t.includes(`fantasy`)?`af`:t.includes(`ultimate`)?`uf`:t.includes(`hybrid`)?`hybrid`:`custom`}function m({mode:e=`main`}={}){let{leagueId:t}=r(),[n]=i(),m=n.get(`round`),h=e===`sevens`,g=h?`/leagues/${t}/reserve7s/fixture`:`/leagues/${t}/fixture`,_=h?`/leagues/${t}/reserve7s/gameday`:`/leagues/${t}/gameday`,v=e=>`/leagues/${t}/matchup/${e}`,{data:y,loading:b}=o(h?`/leagues/${t}/reserve7s/fixture?format=json${m?`&round=${m}`:``}`:`/leagues/${t}/fixture?format=json${m?`&round=${m}`:``}`),x=(0,l.useRef)(null);if((0,l.useEffect)(()=>{if(x.current){let e=x.current.querySelector(`.rnd-item.active`);if(e){let t=e.offsetLeft-x.current.offsetWidth/2+e.offsetWidth/2;x.current.scrollLeft=Math.max(0,t)}}},[y?.selected_round]),b)return(0,u.jsx)(d,{});if(!y)return(0,u.jsx)(`p`,{className:`text-danger`,children:`Failed to load fixture`});let{round_meta:S,selected_round:C,current_fixtures:w,scoring:T,is_commissioner:E}=y,D=Object.keys(S).map(Number).sort((e,t)=>e-t),O=S[String(C)]||`scheduled`,k=p(T.label),A=D.length>0,j=h?`#bc8cff`:`#ececf6`,M=h?`rgba(188,140,255,.08)`:`rgba(236,236,246,.08)`,N=h?`rgba(188,140,255,.3)`:`rgba(236,236,246,.3)`;return(0,u.jsxs)(`div`,{className:h?`fx-sevens`:``,children:[(0,u.jsx)(`style`,{children:f}),h&&(0,u.jsx)(`style`,{children:`
    .fx-sevens .mx-sc.won { color: #bc8cff !important; }
    .fx-sevens .mx-live-tag { color: #bc8cff !important; background: rgba(188,140,255,.1) !important; }
    .fx-sevens .rnd-item.active::after { background: #bc8cff !important; box-shadow: 0 0 6px rgba(188,140,255,.5) !important; }
    .fx-sevens .rnd-dot-live { background: #bc8cff !important; }
    .fx-sevens .rnd-item.rnd-live .rnd-num { color: #bc8cff !important; }
    .fx-sevens .rh-complete { background: rgba(188,140,255,.15) !important; color: #bc8cff !important; }
    .fx-sevens .rh-live { background: rgba(188,140,255,.15) !important; color: #bc8cff !important; }
    .fx-sevens .rh-btn-primary { color: #bc8cff !important; border-color: rgba(188,140,255,.3) !important; }
    .fx-sevens .rh-btn-primary:hover { border-color: #bc8cff !important; background: rgba(188,140,255,.06) !important; }
  `}),(0,u.jsx)(`div`,{className:`d-none d-lg-block`,children:(0,u.jsx)(c,{active:`fixture`,leagueId:t})}),(0,u.jsxs)(`div`,{className:`comp-toggle`,children:[h?(0,u.jsx)(a,{to:`/leagues/${t}/fixture`,className:`comp-toggle-btn text-decoration-none`,style:{borderColor:`#2a292f`,color:`var(--kl-text-primary)`,borderRadius:`8px 0 0 8px`},children:`Main`}):(0,u.jsx)(`span`,{className:`comp-toggle-btn`,style:{borderColor:N,color:j,background:M,borderRadius:`8px 0 0 8px`},children:`Main`}),h?(0,u.jsx)(`span`,{className:`comp-toggle-btn`,style:{borderColor:N,color:j,background:M,borderRadius:`0 8px 8px 0`,borderLeft:0},children:`7s`}):(0,u.jsx)(a,{to:`/leagues/${t}/reserve7s/fixture`,className:`comp-toggle-btn text-decoration-none`,style:{borderColor:`#2a292f`,color:`var(--kl-text-primary)`,borderRadius:`0 8px 8px 0`,borderLeft:0},children:`7s`})]}),A?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`div`,{className:`rnd-strip`,ref:x,children:D.map(e=>{let t=S[String(e)],n=t===`completed`?`rnd-dot-done`:t===`live`?`rnd-dot-live`:t===`partial`?`rnd-dot-part`:`rnd-dot-none`,r=t===`completed`?` rnd-done`:t===`live`?` rnd-live`:``;return(0,u.jsxs)(a,{to:`${g}?round=${e}`,className:`rnd-item${e===C?` active`:``}${r}`,children:[(0,u.jsx)(`span`,{className:`rnd-num`,children:e===0?`OR`:e}),(0,u.jsx)(`span`,{className:`rnd-dot ${n}`})]},e)})}),(0,u.jsxs)(`div`,{className:`round-hdr`,children:[(0,u.jsxs)(`div`,{className:`round-hdr-left`,children:[(0,u.jsx)(`h3`,{children:C===0?`Opening Round`:`Round ${C}`}),O===`completed`&&(0,u.jsx)(`span`,{className:`rh-badge rh-complete`,children:`Complete`}),O===`live`&&(0,u.jsxs)(`span`,{className:`rh-badge rh-live`,children:[(0,u.jsx)(`i`,{className:`bi bi-broadcast me-1`,style:{fontSize:`.8125rem`}}),`Live`]}),O===`partial`&&(0,u.jsx)(`span`,{className:`rh-badge rh-progress`,children:`In Progress`}),(0,u.jsx)(`span`,{className:`scoring-tag`,"data-type":k,children:T.label})]}),(0,u.jsx)(`div`,{className:`rh-actions`,children:w.length>0&&(O===`live`||O===`completed`||O===`partial`)&&(0,u.jsxs)(a,{to:`${_}?round=${C}`,className:`rh-btn`,children:[(0,u.jsx)(`i`,{className:`bi bi-broadcast me-1`}),`Live`]})})]}),(0,u.jsx)(`div`,{className:`mx-list`,children:w.map(e=>{let t=e.status===`completed`&&(e.home_score||0)>(e.away_score||0),n=e.status===`completed`&&(e.away_score||0)>(e.home_score||0),r=O===`live`||O===`partial`||h?`${_}?round=${C}&fixture=${e.id}`:v(e.id),i=e.status===`live`||e.status===`partial`,o=i&&(e.home_score||0)>(e.away_score||0),c=i&&(e.away_score||0)>(e.home_score||0),l=e.status===`completed`||i||e.home_score!=null&&e.away_score!=null,d=i&&!!e.home_total&&!!e.away_total,f=e.home_total?`${e.home_played??0}/${e.home_total}`:null,p=e.away_total?`${e.away_played??0}/${e.away_total}`:null,m={display:`block`,maxWidth:`100%`,whiteSpace:`nowrap`,overflow:`hidden`,textOverflow:`ellipsis`};return(0,u.jsxs)(a,{to:r,className:`mx-row`,style:{position:`relative`},children:[(0,u.jsxs)(`div`,{className:`mx-team mx-team-home`,style:{display:`flex`,flexDirection:`column`,alignItems:`flex-start`,gap:1,minWidth:0},children:[(0,u.jsxs)(`span`,{className:`mx-name`,children:[(0,u.jsx)(s,{name:e.home_team_id,size:30,showName:!1}),(0,u.jsx)(`span`,{style:m,children:e.home_team?.name})]}),d&&f&&(0,u.jsxs)(`span`,{style:{fontSize:`.8125rem`,color:`var(--kl-text-primary)`,fontVariantNumeric:`tabular-nums`,fontWeight:500},children:[f,` played`]})]}),(0,u.jsx)(`div`,{className:`mx-centre`,style:{minWidth:90},children:l?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`span`,{className:`mx-sc${t||o?` won`:n||c?` lost`:` draw`}`,children:Math.round(e.home_score||0)}),(0,u.jsx)(`span`,{className:`mx-sep`,children:`–`}),(0,u.jsx)(`span`,{className:`mx-sc${n||c?` won`:t||o?` lost`:` draw`}`,children:Math.round(e.away_score||0)})]}):(0,u.jsx)(`span`,{className:`mx-vs`,children:`vs`})}),(0,u.jsxs)(`div`,{className:`mx-team mx-team-away`,style:{display:`flex`,flexDirection:`column`,alignItems:`flex-end`,gap:1,minWidth:0},children:[(0,u.jsxs)(`span`,{className:`mx-name mx-name-r`,children:[(0,u.jsx)(`span`,{style:m,children:e.away_team?.name}),(0,u.jsx)(s,{name:e.away_team_id,size:30,showName:!1})]}),d&&p&&(0,u.jsxs)(`span`,{style:{fontSize:`.8125rem`,color:`var(--kl-text-primary)`,fontVariantNumeric:`tabular-nums`,fontWeight:500},children:[p,` played`]})]}),(0,u.jsx)(`div`,{className:`mx-arrow`,children:(0,u.jsx)(`i`,{className:`bi bi-chevron-right`,style:{fontSize:`.8125rem`}})})]},e.id)})})]}):(0,u.jsxs)(`div`,{className:`season-empty`,children:[(0,u.jsx)(`i`,{className:`bi bi-calendar-week`}),(0,u.jsx)(`h4`,{children:`No fixture generated`}),(0,u.jsx)(`p`,{children:E?(0,u.jsxs)(u.Fragment,{children:[`Head to `,(0,u.jsx)(a,{to:`/leagues/${t}/settings`,children:`Settings`}),` to generate the season fixture.`]}):`The commissioner hasn't set up the fixture yet.`})]})]})}export{m as t};