import{f as e,h as t,i as n,n as r,p as i,t as a,v as o}from"./Spinner-DbpdyvTu.js";import{t as s}from"./useFetch-Cg3atgj2.js";import{t as c}from"./LeagueSubnav-C818Q6By.js";var l=o(t(),1),u=r(),d=`
.rnd-strip { display:flex; align-items:stretch; background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; margin-bottom:20px; }
.rnd-strip::-webkit-scrollbar { display:none; }
.rnd-item { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1 1 0; min-width:44px; padding:12px 2px 10px; text-decoration:none; border-right:1px solid #161b22; transition:background .12s; position:relative; cursor:pointer; color:inherit; }
.rnd-item:last-child { border-right:none; }
.rnd-item:hover { background:#161b22; }
.rnd-item.active { background:#161b22; }
.rnd-item.active::after { content:''; position:absolute; bottom:0; left:20%; right:20%; height:2px; background:#58a6ff; border-radius:1px 1px 0 0; box-shadow:0 0 6px rgba(88,166,255,.5); }
.rnd-num { font-size:.78rem; font-weight:600; color:#484f58; line-height:1; transition:color .12s; }
.rnd-item:hover .rnd-num { color:#8b949e; }
.rnd-item.active .rnd-num { color:#e6edf3; }
.rnd-item.rnd-done .rnd-num { color:#8b949e; }
.rnd-item.rnd-live .rnd-num { color:#3fb950; }
.rnd-dot { width:5px; height:5px; border-radius:50%; margin-top:4px; }
.rnd-dot-done { background:#484f58; }
.rnd-dot-live { background:#3fb950; animation:livePulse 1.8s ease-in-out infinite; }
.rnd-dot-part { background:#9e6a03; }
.rnd-dot-none { background:transparent; }
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.4);} }
.round-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #21262d; }
.round-hdr-left { display:flex; align-items:baseline; gap:10px; }
.round-hdr h3 { font-size:1.05rem; font-weight:700; color:#e6edf3; margin:0; letter-spacing:-.01em; }
.round-hdr .rh-badge { font-size:.6rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
.rh-complete { background:rgba(46,160,67,.1); color:#2ea043; }
.rh-live { background:rgba(63,185,80,.12); color:#3fb950; }
.rh-progress { background:rgba(158,106,3,.1); color:#d29922; }
.rh-actions { display:flex; gap:6px; align-items:center; }
.rh-btn { font-size:.7rem; padding:4px 10px; border-radius:6px; border:1px solid #30363d; background:transparent; color:#8b949e; text-decoration:none; transition:all .12s; cursor:pointer; }
.rh-btn:hover { border-color:#484f58; color:#c9d1d9; }
.rh-btn-primary { border-color:rgba(88,166,255,.3); color:#58a6ff; }
.rh-btn-primary:hover { border-color:#58a6ff; background:rgba(88,166,255,.06); }
.mx-list { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.mx-row { display:grid; grid-template-columns:1fr auto 1fr auto; align-items:center; padding:14px 20px; gap:0; border-bottom:1px solid #161b22; transition:background .1s; text-decoration:none; color:inherit; cursor:pointer; }
.mx-row:last-child { border-bottom:none; }
.mx-row:hover { background:rgba(22,27,34,.6); }
.mx-team { font-size:.85rem; font-weight:500; color:#c9d1d9; text-decoration:none; transition:color .1s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mx-team:hover { color:#58a6ff; }
.mx-team-home { text-align:left; padding-right:12px; }
.mx-team-away { text-align:right; padding-left:12px; }
.mx-team.won { color:#e6edf3; font-weight:700; }
.mx-centre { display:flex; align-items:center; justify-content:center; min-width:100px; gap:0; }
.mx-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.mx-sc.won { color:#3fb950; }
.mx-sc.lost { color:#6e7681; }
.mx-sc.draw { color:#8b949e; }
.mx-sep { color:#21262d; margin:0 4px; font-weight:300; font-size:.8rem; }
.mx-vs { font-size:.65rem; font-weight:700; color:#30363d; letter-spacing:1.5px; text-transform:uppercase; }
.mx-live-tag { font-size:.55rem; font-weight:700; color:#3fb950; letter-spacing:.5px; background:rgba(63,185,80,.08); padding:2px 6px; border-radius:3px; }
.mx-arrow { display:flex; align-items:center; justify-content:center; width:28px; color:#21262d; transition:color .1s; }
.mx-row:hover .mx-arrow { color:#484f58; }
.season-empty { text-align:center; padding:60px 20px; color:#484f58; }
.season-empty i { font-size:2rem; margin-bottom:12px; display:block; color:#30363d; }
.season-empty h4 { color:#8b949e; font-size:1rem; font-weight:600; margin-bottom:4px; }
.season-empty p { font-size:.8rem; }
.season-empty a { color:#58a6ff; }
`;function f(e){let t=e.toLowerCase();return t.includes(`supercoach`)?`sc`:t.includes(`fantasy`)?`af`:t.includes(`ultimate`)?`uf`:t.includes(`hybrid`)?`hybrid`:`custom`}function p({mode:t=`main`}={}){let{leagueId:r}=e(),[o]=i(),p=o.get(`round`),m=t===`sevens`,h=m?`/leagues/${r}/reserve7s/fixture`:`/leagues/${r}/fixture`,g=m?`/leagues/${r}/reserve7s/gameday`:`/leagues/${r}/gameday`,_=e=>m?`/leagues/${r}/reserve7s/matchup/${e}`:`/leagues/${r}/matchup/${e}`,{data:v,loading:y}=s(m?`/leagues/${r}/reserve7s/fixture?format=json${p?`&round=${p}`:``}`:`/leagues/${r}/fixture?format=json${p?`&round=${p}`:``}`),b=(0,l.useRef)(null);if((0,l.useEffect)(()=>{if(b.current){let e=b.current.querySelector(`.rnd-item.active`);if(e){let t=e.offsetLeft-b.current.offsetWidth/2+e.offsetWidth/2;b.current.scrollLeft=Math.max(0,t)}}},[v?.selected_round]),y)return(0,u.jsx)(a,{text:`Loading fixture...`});if(!v)return(0,u.jsx)(`p`,{className:`text-danger`,children:`Failed to load fixture`});let{round_meta:x,selected_round:S,current_fixtures:C,scoring:w,is_commissioner:T}=v,E=Object.keys(x).map(Number).sort((e,t)=>e-t),D=x[String(S)]||`scheduled`,O=f(w.label),k=E.length>0,A=m?`#bc8cff`:`#58a6ff`,j=m?`rgba(188,140,255,.08)`:`rgba(88,166,255,.08)`,M=m?`rgba(188,140,255,.3)`:`rgba(88,166,255,.3)`;return(0,u.jsxs)(`div`,{className:m?`fx-sevens`:``,children:[(0,u.jsx)(`style`,{children:d}),m&&(0,u.jsx)(`style`,{children:`
    .fx-sevens .mx-sc.won { color: #bc8cff !important; }
    .fx-sevens .mx-live-tag { color: #bc8cff !important; background: rgba(188,140,255,.1) !important; }
    .fx-sevens .rnd-item.active::after { background: #bc8cff !important; box-shadow: 0 0 6px rgba(188,140,255,.5) !important; }
    .fx-sevens .rnd-dot-live { background: #bc8cff !important; }
    .fx-sevens .rnd-item.rnd-live .rnd-num { color: #bc8cff !important; }
    .fx-sevens .rh-complete { background: rgba(188,140,255,.15) !important; color: #bc8cff !important; }
    .fx-sevens .rh-live { background: rgba(188,140,255,.15) !important; color: #bc8cff !important; }
    .fx-sevens .rh-btn-primary { color: #bc8cff !important; border-color: rgba(188,140,255,.3) !important; }
    .fx-sevens .rh-btn-primary:hover { border-color: #bc8cff !important; background: rgba(188,140,255,.06) !important; }
  `}),(0,u.jsx)(`div`,{className:`d-none d-lg-block`,children:(0,u.jsx)(c,{active:`fixture`,leagueId:r})}),(0,u.jsxs)(`div`,{className:`comp-toggle`,children:[m?(0,u.jsx)(n,{to:`/leagues/${r}/fixture`,className:`comp-toggle-btn text-decoration-none`,style:{borderColor:`#30363d`,color:`#8b949e`,borderRadius:`8px 0 0 8px`},children:`Main`}):(0,u.jsx)(`span`,{className:`comp-toggle-btn`,style:{borderColor:M,color:A,background:j,borderRadius:`8px 0 0 8px`},children:`Main`}),m?(0,u.jsx)(`span`,{className:`comp-toggle-btn`,style:{borderColor:M,color:A,background:j,borderRadius:`0 8px 8px 0`,borderLeft:0},children:`7s`}):(0,u.jsx)(n,{to:`/leagues/${r}/reserve7s/fixture`,className:`comp-toggle-btn text-decoration-none`,style:{borderColor:`#30363d`,color:`#8b949e`,borderRadius:`0 8px 8px 0`,borderLeft:0},children:`7s`})]}),k?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`div`,{className:`rnd-strip`,ref:b,children:E.map(e=>{let t=x[String(e)],r=t===`completed`?`rnd-dot-done`:t===`live`?`rnd-dot-live`:t===`partial`?`rnd-dot-part`:`rnd-dot-none`,i=t===`completed`?` rnd-done`:t===`live`?` rnd-live`:``;return(0,u.jsxs)(n,{to:`${h}?round=${e}`,className:`rnd-item${e===S?` active`:``}${i}`,children:[(0,u.jsx)(`span`,{className:`rnd-num`,children:e===0?`PS`:e}),(0,u.jsx)(`span`,{className:`rnd-dot ${r}`})]},e)})}),(0,u.jsxs)(`div`,{className:`round-hdr`,children:[(0,u.jsxs)(`div`,{className:`round-hdr-left`,children:[(0,u.jsx)(`h3`,{children:S===0?`Pre-Season`:`Round ${S}`}),D===`completed`&&(0,u.jsx)(`span`,{className:`rh-badge rh-complete`,children:`Complete`}),D===`live`&&(0,u.jsxs)(`span`,{className:`rh-badge rh-live`,children:[(0,u.jsx)(`i`,{className:`bi bi-broadcast me-1`,style:{fontSize:`.5rem`}}),`Live`]}),D===`partial`&&(0,u.jsx)(`span`,{className:`rh-badge rh-progress`,children:`In Progress`}),(0,u.jsx)(`span`,{className:`scoring-tag`,"data-type":O,children:w.label})]}),(0,u.jsx)(`div`,{className:`rh-actions`,children:C.length>0&&(D===`live`||D===`completed`||D===`partial`)&&(0,u.jsxs)(n,{to:`${g}?round=${S}`,className:`rh-btn`,children:[(0,u.jsx)(`i`,{className:`bi bi-broadcast me-1`}),`Live`]})})]}),(0,u.jsx)(`div`,{className:`mx-list`,children:C.map(e=>{let t=e.status===`completed`&&(e.home_score||0)>(e.away_score||0),r=e.status===`completed`&&(e.away_score||0)>(e.home_score||0),i=D===`live`||D===`partial`?`${g}?round=${S}&fixture=${e.id}`:_(e.id),a=e.status===`live`||e.status===`partial`,o=a&&(e.home_score||0)>(e.away_score||0),s=a&&(e.away_score||0)>(e.home_score||0),c=e.status===`completed`||a||e.home_score!=null&&e.away_score!=null,l=a&&!!e.home_total&&!!e.away_total,d=e.home_total?`${e.home_played??0}/${e.home_total}`:null,f=e.away_total?`${e.away_played??0}/${e.away_total}`:null;return(0,u.jsxs)(n,{to:i,className:`mx-row`,style:{position:`relative`},children:[(0,u.jsxs)(`div`,{className:`mx-team mx-team-home`,style:{display:`flex`,flexDirection:`column`,alignItems:`flex-start`,gap:1},children:[(0,u.jsx)(`span`,{className:t||o?`won`:``,style:{fontWeight:t||o?700:500},children:e.home_team?.name}),l&&d&&(0,u.jsxs)(`span`,{style:{fontSize:`.62rem`,color:`#6e7681`,fontVariantNumeric:`tabular-nums`,fontWeight:500},children:[d,` played`]})]}),(0,u.jsx)(`div`,{className:`mx-centre`,style:{minWidth:110},children:c?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`span`,{className:`mx-sc${t||o?` won`:r||s?` lost`:` draw`}`,children:Math.round(e.home_score||0)}),(0,u.jsx)(`span`,{className:`mx-sep`,children:`–`}),(0,u.jsx)(`span`,{className:`mx-sc${r||s?` won`:t||o?` lost`:` draw`}`,children:Math.round(e.away_score||0)})]}):(0,u.jsx)(`span`,{className:`mx-vs`,children:`vs`})}),(0,u.jsxs)(`div`,{className:`mx-team mx-team-away`,style:{display:`flex`,flexDirection:`column`,alignItems:`flex-end`,gap:1},children:[(0,u.jsx)(`span`,{className:r||s?`won`:``,style:{fontWeight:r||s?700:500},children:e.away_team?.name}),l&&f&&(0,u.jsxs)(`span`,{style:{fontSize:`.62rem`,color:`#6e7681`,fontVariantNumeric:`tabular-nums`,fontWeight:500},children:[f,` played`]})]}),(0,u.jsx)(`div`,{className:`mx-arrow`,children:(0,u.jsx)(`i`,{className:`bi bi-chevron-right`,style:{fontSize:`.65rem`}})})]},e.id)})})]}):(0,u.jsxs)(`div`,{className:`season-empty`,children:[(0,u.jsx)(`i`,{className:`bi bi-calendar-week`}),(0,u.jsx)(`h4`,{children:`No fixture generated`}),(0,u.jsx)(`p`,{children:T?(0,u.jsxs)(u.Fragment,{children:[`Head to `,(0,u.jsx)(n,{to:`/leagues/${r}/settings`,children:`Settings`}),` to generate the season fixture.`]}):`The commissioner hasn't set up the fixture yet.`})]})]})}export{p as t};