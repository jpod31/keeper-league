import{f as e,h as t,i as n,n as r,p as i,t as a,v as o}from"./Spinner-DbpdyvTu.js";import{t as s}from"./useFetch-DFCVHv6Q.js";import{t as c}from"./LeagueSubnav-CCkc_noM.js";var l=o(t(),1),u=r(),d=`
.s7f-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.s7f-title h3 { font-size:1.1rem; font-weight:700; color:#e6edf3; margin:0; }
.s7f-title-badge { font-size:.6rem; font-weight:700; padding:3px 8px; border-radius:4px; background:rgba(188,140,255,.1); color:#bc8cff; letter-spacing:.5px; }
.s7f-strip { display:flex; align-items:stretch; background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; margin-bottom:20px; }
.s7f-strip::-webkit-scrollbar { display:none; }
.s7f-item { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1 1 0; min-width:44px; padding:12px 2px 10px; text-decoration:none; border-right:1px solid #161b22; transition:background .12s; position:relative; cursor:pointer; color:inherit; }
.s7f-item:last-child { border-right:none; }
.s7f-item:hover { background:#161b22; }
.s7f-item.active { background:#161b22; }
.s7f-item.active::after { content:''; position:absolute; bottom:0; left:20%; right:20%; height:2px; background:#bc8cff; border-radius:1px 1px 0 0; box-shadow:0 0 6px rgba(188,140,255,.5); }
.s7f-num { font-size:.78rem; font-weight:600; color:#484f58; line-height:1; transition:color .12s; }
.s7f-item:hover .s7f-num { color:#8b949e; }
.s7f-item.active .s7f-num { color:#e6edf3; }
.s7f-item.s7f-done .s7f-num { color:#8b949e; }
.s7f-item.s7f-live .s7f-num { color:#3fb950; }
.s7f-dot { width:5px; height:5px; border-radius:50%; margin-top:4px; }
.s7f-dot-done { background:#bc8cff; }
.s7f-dot-live { background:#3fb950; animation:livePulse 1.8s ease-in-out infinite; }
.s7f-dot-none { background:transparent; }
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.4);} }
.s7f-list { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.s7f-row { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:14px 20px; gap:0; border-bottom:1px solid #161b22; transition:background .1s; }
.s7f-row:last-child { border-bottom:none; }
.s7f-row:hover { background:rgba(22,27,34,.6); }
.s7f-team { font-size:.85rem; font-weight:500; color:#c9d1d9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.s7f-team-home { text-align:left; padding-right:12px; }
.s7f-team-away { text-align:right; padding-left:12px; }
.s7f-team.won { color:#e6edf3; font-weight:700; }
.s7f-centre { display:flex; align-items:center; justify-content:center; min-width:100px; gap:0; }
.s7f-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.s7f-sc.won { color:#3fb950; }
.s7f-sc.lost { color:#6e7681; }
.s7f-sep { color:#21262d; margin:0 4px; font-weight:300; font-size:.8rem; }
.s7f-vs { font-size:.65rem; font-weight:700; color:#30363d; letter-spacing:1.5px; text-transform:uppercase; }
.s7f-round-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #21262d; }
.s7f-round-hdr h3 { font-size:1.05rem; font-weight:700; color:#e6edf3; margin:0; }
.s7f-rh-badge { font-size:.6rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
.s7f-rh-complete { background:rgba(188,140,255,.1); color:#bc8cff; }
.s7f-rh-live { background:rgba(63,185,80,.12); color:#3fb950; }
.s7f-empty { text-align:center; padding:60px 20px; color:#484f58; }
.s7f-empty i { font-size:2rem; margin-bottom:12px; display:block; color:#30363d; }
.s7f-empty h4 { color:#8b949e; font-size:1rem; font-weight:600; }
.s7-subnav { display:flex; gap:2px; margin-bottom:12px; border-bottom:1px solid #21262d; }
.s7-subnav-tab { padding:8px 16px; font-size:.78rem; font-weight:600; color:#8b949e; text-decoration:none; border-bottom:2px solid transparent; transition:all .15s; }
.s7-subnav-tab:hover { color:#c9d1d9; }
.s7-subnav-tab.active { color:#bc8cff; border-bottom-color:#bc8cff; }
`;function f(){let{leagueId:t}=e(),[r]=i(),o=r.get(`round`),{data:f,loading:p,refetch:m}=s(`/leagues/${t}/reserve7s/fixture?format=json${o?`&round=${o}`:``}`),h=(0,l.useRef)(null),[g,_]=(0,l.useState)(!1);async function v(){_(!0);try{await fetch(`/leagues/${t}/reserve7s/generate-fixture`,{method:`POST`,credentials:`include`,redirect:`manual`}),m()}catch(e){alert(e.message)}finally{_(!1)}}if((0,l.useEffect)(()=>{if(h.current){let e=h.current.querySelector(`.s7f-item.active`);if(e){let t=e.offsetLeft-h.current.offsetWidth/2+e.offsetWidth/2;h.current.scrollLeft=Math.max(0,t)}}},[f?.selected_round]),p)return(0,u.jsx)(a,{text:`Loading 7s fixture...`});if(!f)return(0,u.jsx)(`p`,{className:`text-danger`,children:`Failed to load 7s fixture`});let{round_meta:y,selected_round:b,current_fixtures:x,scoring:S,is_commissioner:C}=f,w=Object.keys(y).map(Number).sort((e,t)=>e-t),T=y[String(b)]||`scheduled`,E=w.length>0;return(0,u.jsxs)(`div`,{children:[(0,u.jsx)(`style`,{children:d}),(0,u.jsx)(c,{active:`7s`,leagueId:t}),(0,u.jsxs)(`div`,{className:`s7-subnav`,children:[(0,u.jsx)(n,{to:`/leagues/${t}/reserve7s/standings`,className:`s7-subnav-tab`,children:`Ladder`}),(0,u.jsx)(n,{to:`/leagues/${t}/reserve7s/fixture`,className:`s7-subnav-tab active`,children:`Fixture`}),(0,u.jsx)(n,{to:`/leagues/${t}/reserve7s/gameday`,className:`s7-subnav-tab`,children:`Gameday`}),(0,u.jsx)(n,{to:`/leagues/${t}/reserve7s/team`,className:`s7-subnav-tab`,children:`My 7s`})]}),(0,u.jsxs)(`div`,{className:`s7f-title`,children:[(0,u.jsxs)(`h3`,{children:[(0,u.jsx)(`i`,{className:`bi bi-7-circle me-1`,style:{color:`#bc8cff`}}),`Reserve 7s Season`]}),(0,u.jsx)(`span`,{className:`s7f-title-badge`,children:`RESERVE 7s`})]}),E?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`div`,{className:`s7f-strip`,ref:h,children:w.map(e=>{let r=y[String(e)],i=r===`completed`?`s7f-dot-done`:r===`live`?`s7f-dot-live`:`s7f-dot-none`,a=r===`completed`?` s7f-done`:r===`live`?` s7f-live`:``;return(0,u.jsxs)(n,{to:`/leagues/${t}/reserve7s/fixture?round=${e}`,className:`s7f-item${e===b?` active`:``}${a}`,children:[(0,u.jsx)(`span`,{className:`s7f-num`,children:e}),(0,u.jsx)(`span`,{className:`s7f-dot ${i}`})]},e)})}),(0,u.jsx)(`div`,{className:`s7f-round-hdr`,children:(0,u.jsxs)(`div`,{style:{display:`flex`,alignItems:`baseline`,gap:10},children:[(0,u.jsxs)(`h3`,{children:[`Round `,b]}),T===`completed`&&(0,u.jsx)(`span`,{className:`s7f-rh-badge s7f-rh-complete`,children:`Complete`}),T===`live`&&(0,u.jsxs)(`span`,{className:`s7f-rh-badge s7f-rh-live`,children:[(0,u.jsx)(`i`,{className:`bi bi-broadcast me-1`}),`Live`]}),(0,u.jsx)(`span`,{className:`s7f-title-badge`,children:S.label})]})}),(0,u.jsx)(`div`,{className:`s7f-list`,children:x.map(e=>{let t=e.status===`completed`&&(e.home_score||0)>(e.away_score||0),n=e.status===`completed`&&(e.away_score||0)>(e.home_score||0);return(0,u.jsxs)(`div`,{className:`s7f-row`,children:[(0,u.jsx)(`span`,{className:`s7f-team s7f-team-home${t?` won`:``}`,children:e.home_team?.name}),(0,u.jsx)(`div`,{className:`s7f-centre`,children:e.status===`completed`?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`span`,{className:`s7f-sc${t?` won`:` lost`}`,children:Math.round(e.home_score||0)}),(0,u.jsx)(`span`,{className:`s7f-sep`,children:`–`}),(0,u.jsx)(`span`,{className:`s7f-sc${n?` won`:` lost`}`,children:Math.round(e.away_score||0)})]}):(0,u.jsx)(`span`,{className:`s7f-vs`,children:`vs`})}),(0,u.jsx)(`span`,{className:`s7f-team s7f-team-away${n?` won`:``}`,children:e.away_team?.name})]},e.id)})})]}):(0,u.jsxs)(`div`,{className:`s7f-empty`,children:[(0,u.jsx)(`i`,{className:`bi bi-calendar-week`}),(0,u.jsx)(`h4`,{children:`No Reserve 7s fixture yet`}),(0,u.jsx)(`p`,{style:{fontSize:`.8rem`},children:`The 7s fixture auto-generates when the main season fixture is created.`}),C&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`p`,{style:{fontSize:`.75rem`,color:`#484f58`,marginTop:8},children:`Or generate manually:`}),(0,u.jsxs)(`button`,{type:`button`,className:`s7f-generate-btn`,onClick:v,disabled:g,style:{display:`inline-block`,marginTop:12,padding:`8px 20px`,borderRadius:8,fontSize:`.8rem`,fontWeight:600,color:`#bc8cff`,background:`rgba(188,140,255,.08)`,border:`1px solid rgba(188,140,255,.2)`,cursor:`pointer`},children:[(0,u.jsx)(`i`,{className:`bi bi-plus-circle me-1`}),g?`Generating...`:`Generate 7s Fixture`]})]})]})]})}export{f as Reserve7sFixturePage};