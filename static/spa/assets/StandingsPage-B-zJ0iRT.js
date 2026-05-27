import{b as e,f as t,h as n,i as r,n as i,t as a}from"./Spinner-BZqcd_eb.js";import{t as o}from"./LeagueSubnav-Bcz2FURZ.js";import{t as s}from"./useFetch-1yv96nK-.js";var c=e(n(),1),l=i(),u=[{hex:`#3a7dc4`,rgb:`58,125,196`},{hex:`#b87f3d`,rgb:`184,127,61`},{hex:`#8a6db8`,rgb:`138,109,184`},{hex:`#3d8c63`,rgb:`61,140,99`},{hex:`#c2932f`,rgb:`194,147,47`},{hex:`#b85a4a`,rgb:`184,90,74`},{hex:`#3d8a9c`,rgb:`61,138,156`},{hex:`#9d5878`,rgb:`157,88,120`}];function d(e){return u[(e||0)%u.length]}function f(e){return(e||`Steady`).toLowerCase().replace(/\s+/g,``)}function p(e){let t=(e||``).toLowerCase();return t.includes(`supercoach`)?`sc`:t.includes(`fantasy`)?`af`:t.includes(`ultimate`)?`uf`:t.includes(`hybrid`)?`hybrid`:`custom`}var m=`
.lad-wrap { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
/* Grid: # | Team | Status | PR | W-L | Form | Mov | PF | PA | % | Pts */
.lad-head, .lad-row {
  display: grid;
  grid-template-columns: 36px 1fr 130px 52px 76px 110px 64px 70px 70px 64px 56px;
  gap: 10px;
  align-items: center;
}
.lad-head {
  padding: 0 16px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #6c7892;
  margin-bottom: 4px;
}
.lad-head > * { text-align: right; }
.lad-head > :nth-child(1), .lad-head > :nth-child(2), .lad-head > :nth-child(3) { text-align: left; }

/* Sortable header buttons */
.lad-head button.lad-sort {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  transition: color .14s ease;
  font: inherit;
  letter-spacing: inherit;
}
.lad-head button.lad-sort:hover { color: #b6c0d3; }
.lad-head .lad-sort-chev {
  font-size: .55rem;
  opacity: .25;
  transition: opacity .14s ease, color .14s ease;
}
.lad-head .lad-sort.active { color: #dde4f1; }
.lad-head .lad-sort.active .lad-sort-chev { opacity: 1; color: #82b3e4; }
.lad-head > :nth-child(n+4) .lad-sort {
  justify-content: flex-end;
  width: 100%;
}

.lad-row {
  position: relative;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(15,22,36,.7);
  border: 1px solid rgba(110,130,180,.12);
  text-decoration: none;
  color: #dde4f1;
  transition: background .14s ease, border-color .14s ease, transform .14s ease;
}
.lad-row:hover {
  background: rgba(20,28,45,.8);
  border-color: rgba(110,130,180,.22);
  transform: translateX(2px);
  text-decoration: none;
}
.lad-row::before {
  /* Team-coloured 2px left edge stripe */
  content: "";
  position: absolute;
  left: 0; top: 16px; bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: var(--lad-accent, #97a3ba);
  opacity: .65;
}
.lad-row.mine {
  background: linear-gradient(90deg, rgba(var(--lad-accent-rgb, 122,155,196), .14), rgba(var(--lad-accent-rgb, 122,155,196), .04) 60%, transparent);
  border-color: rgba(var(--lad-accent-rgb, 122,155,196), .35);
}
.lad-row.mine::before { width: 3px; opacity: 1; }

/* Rank */
.lad-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 800;
  color: #c0c7d4;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  font-variant-numeric: tabular-nums;
}
.lad-rank-1 { color: #e8c25b; border-color: rgba(232,194,91,.4); background: rgba(232,194,91,.08); }
.lad-rank-2 { color: #b6bdcc; border-color: rgba(182,189,204,.35); background: rgba(182,189,204,.06); }
.lad-rank-3 { color: #b8855d; border-color: rgba(184,133,93,.35); background: rgba(184,133,93,.06); }

/* Team column — just the name. Nothing else. */
.lad-team-name {
  font-size: .92rem;
  font-weight: 700;
  color: #f0f4fc;
  letter-spacing: -.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lad-pill {
  display: inline-flex;
  align-items: center;
  font-size: .54rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.lad-pill-onfire, .lad-pill-dominant { color: #6db38a; border-color: rgba(109,179,138,.4); background: rgba(109,179,138,.1); }
.lad-pill-surging, .lad-pill-strong { color: #82b3e4; border-color: rgba(130,179,228,.4); background: rgba(130,179,228,.1); }
.lad-pill-steady { color: #9aa6bb; border-color: rgba(154,166,187,.3); background: rgba(154,166,187,.06); }
.lad-pill-underperforming, .lad-pill-struggling { color: #d68a7e; border-color: rgba(214,138,126,.35); background: rgba(214,138,126,.08); }
.lad-pill-sliding, .lad-pill-infreefall { color: #e07a6c; border-color: rgba(224,122,108,.45); background: rgba(224,122,108,.12); }

/* W/L record column */
.lad-wl {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .82rem;
  font-weight: 700;
}
.lad-wl .w { color: #6db38a; }
.lad-wl .l { color: #d68a7e; }
.lad-wl .d { color: #c2932f; }
.lad-wl .sep { color: #4a5471; font-weight: 400; }

/* Status column — empty when no headline */
.lad-status { display: flex; align-items: center; }
.lad-status-empty { color: #4a5471; font-size: .68rem; }

/* Power-rank chip — distinct from the ladder rank cell. Top 3 get medal
   gradient + glow, everyone else gets a neutral chip. The small left-edge
   accent strip gives the chip its own identity vs a plain rounded box. */
.lad-pr { text-align: right; display: flex; justify-content: flex-end; align-items: center; }
.lad-pr-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 38px;
  height: 22px;
  padding: 0 9px 0 7px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: -.02em;
  background: linear-gradient(135deg, rgba(110,130,180,.10), rgba(110,130,180,.02));
  border: 1px solid rgba(110,130,180,.22);
  color: #b6c0d3;
  position: relative;
}
.lad-pr-chip::before {
  content: "";
  width: 3px;
  height: 12px;
  background: currentColor;
  opacity: .55;
  border-radius: 2px;
}
.lad-pr-chip.tier-1 {
  background: linear-gradient(135deg, rgba(232,194,91,.28), rgba(232,194,91,.06));
  border-color: rgba(232,194,91,.55);
  color: #f0d27a;
  box-shadow: 0 0 14px -2px rgba(232,194,91,.4);
}
.lad-pr-chip.tier-2 {
  background: linear-gradient(135deg, rgba(204,210,222,.22), rgba(204,210,222,.06));
  border-color: rgba(204,210,222,.48);
  color: #e0e6f1;
}
.lad-pr-chip.tier-3 {
  background: linear-gradient(135deg, rgba(199,152,112,.24), rgba(199,152,112,.06));
  border-color: rgba(199,152,112,.5);
  color: #e0b48a;
}
.lad-pr-empty { color: #4a5471; font-size: .82rem; }

/* Form sparkline (last N results) */
.lad-form {
  display: flex;
  gap: 3px;
  justify-content: flex-end;
}
.lad-form-dot {
  width: 6px;
  height: 18px;
  border-radius: 2px;
  background: rgba(255,255,255,.04);
}
.lad-form-dot.W { background: #3d8c63; }
.lad-form-dot.L { background: #b85a4a; }
.lad-form-dot.D { background: #c2932f; }

/* Momentum chip */
.lad-momentum {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .72rem;
  font-weight: 700;
  color: #97a3ba;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,.03);
  min-width: 56px;
}
.lad-momentum.up { color: #6db38a; background: rgba(61,140,99,.1); }
.lad-momentum.down { color: #d68a7e; background: rgba(184,90,74,.1); }
.lad-momentum.flat { color: #6c7892; }

/* Numeric columns */
.lad-num {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .92rem;
  font-weight: 600;
  color: #dde4f1;
  text-align: right;
}
.lad-num-strong { font-size: 1rem; font-weight: 800; color: #f0f4fc; }
.lad-num-muted { color: #97a3ba; }
.lad-num .unit {
  font-size: .68rem;
  font-weight: 500;
  color: #6c7892;
  margin-left: 2px;
}

.lad-record { display: inline-flex; gap: 4px; align-items: baseline; }
.lad-record .w { color: #6db38a; }
.lad-record .l { color: #d68a7e; }
.lad-record .d { color: #c2932f; }

/* Finals cut divider */
.lad-cut {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 8px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(109,179,138,.65);
}
.lad-cut::before, .lad-cut::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(109,179,138,.35), transparent);
}
.lad-cut span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(61,140,99,.08);
  border: 1px solid rgba(61,140,99,.25);
}

/* Footer */
.lad-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px 4px;
  font-size: .68rem;
  color: #6c7892;
}
.lad-foot .scoring-tag {
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(110,130,180,.25);
  background: rgba(15,22,36,.5);
  color: #b8c2d4;
}

/* Empty state */
.lad-empty { text-align: center; padding: 60px 20px; color: #4a5471; }
.lad-empty i { font-size: 2rem; display: block; margin-bottom: 12px; color: #38415a; }
.lad-empty h4 { color: #97a3ba; font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
.lad-empty p { font-size: .82rem; margin: 0; }

/* Competition toggle */
.lad-comp-toggle {
  display: inline-flex;
  background: rgba(15,22,36,.5);
  border: 1px solid rgba(110,130,180,.18);
  border-radius: 999px;
  padding: 3px;
  margin-bottom: 16px;
}
.lad-comp-btn {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: .74rem;
  font-weight: 700;
  color: #97a3ba;
  text-decoration: none;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.lad-comp-btn:hover { color: #dde4f1; text-decoration: none; }
.lad-comp-btn.active {
  background: rgba(58,125,196,.18);
  color: #82b3e4;
}
.lad-sevens .lad-comp-btn.active {
  background: rgba(138,109,184,.18);
  color: #b39ed4;
}

/* Mobile — compact 3-column layout */
@media (max-width: 768px) {
  .lad-head { display: none; }
  .lad-row {
    grid-template-columns: 28px 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px 10px;
    padding: 12px 14px;
  }
  .lad-row > .lad-rank { grid-row: 1; grid-column: 1; }
  .lad-row > .lad-team-name { grid-row: 1; grid-column: 2; }
  .lad-row > .lad-num-strong { grid-row: 1; grid-column: 3; }
  .lad-row > .lad-status { grid-row: 2; grid-column: 2 / 4; justify-self: start; }
  .lad-row > .lad-form { grid-row: 2; grid-column: 1; justify-content: flex-start; }
  .lad-row > .lad-num:not(.lad-num-strong),
  .lad-row > .lad-pr,
  .lad-row > .lad-wl,
  .lad-row > .lad-momentum { display: none; }
}

/* Sevens mode — purple accent palette */
.lad-sevens .lad-form-dot.W { background: #8a6db8; }
.lad-sevens .lad-num-strong { color: #b39ed4; }
`,h={pos:`asc`,name:`asc`,pr:`asc`,wins:`desc`,mov:`desc`,pf:`desc`,pa:`desc`,pct:`desc`,pts:`desc`};function g({mode:e=`main`}={}){let{leagueId:n}=t(),i=e===`sevens`,{data:u,loading:g}=s(i?`/leagues/${n}/reserve7s/standings?format=json`:`/leagues/${n}/standings?format=json`),[_,v]=(0,c.useState)(`pos`),[y,b]=(0,c.useState)(`asc`);function x(e){e===_?b(e=>e===`asc`?`desc`:`asc`):(v(e),b(h[e]))}let S=u?.standings??[],C=u?.rankings??[],w=(0,c.useMemo)(()=>{let e={};for(let t of C)e[t.team_id]=t;return e},[C]),T=(0,c.useMemo)(()=>{let e=new Map;return S.forEach((t,n)=>e.set(t.team_id,n+1)),e},[S]),E=(0,c.useMemo)(()=>{let e=[...S];return e.sort((e,t)=>{let n=0,r=0;switch(_){case`pos`:n=T.get(e.team_id)??999,r=T.get(t.team_id)??999;break;case`name`:n=(e.team?.name||``).toLowerCase(),r=(t.team?.name||``).toLowerCase();break;case`pr`:n=w[e.team_id]?.rank??999,r=w[t.team_id]?.rank??999;break;case`wins`:n=e.wins*1e3-e.losses,r=t.wins*1e3-t.losses;break;case`mov`:n=w[e.team_id]?.movement??0,r=w[t.team_id]?.movement??0;break;case`pf`:n=e.points_for,r=t.points_for;break;case`pa`:n=e.points_against,r=t.points_against;break;case`pct`:n=e.percentage,r=t.percentage;break;case`pts`:n=e.ladder_points,r=t.ladder_points;break}let i=0;return i=typeof n==`string`&&typeof r==`string`?n.localeCompare(r):n-r,y===`asc`?i:-i}),e},[S,_,y,T,w]);if(g)return(0,l.jsx)(a,{text:`Loading standings...`});if(!u)return(0,l.jsx)(`p`,{className:`text-danger`,children:`Failed to load standings`});let{finals_teams:D,scoring:O,ranking_details:k,team_form:A,user_team_id:j}=u,M=C.length>0,N=p(O.label),P=_===`pos`&&y===`asc`&&D>0,F=({field:e,children:t})=>{let n=_===e;return(0,l.jsxs)(`button`,{type:`button`,className:`lad-sort${n?` active`:``}`,onClick:()=>x(e),children:[t,(0,l.jsx)(`span`,{className:`lad-sort-chev`,children:n?y===`asc`?`▲`:`▼`:`▾`})]})};return(0,l.jsxs)(`div`,{className:i?`lad-sevens`:``,children:[(0,l.jsx)(`style`,{children:m}),(0,l.jsx)(`div`,{className:`d-none d-lg-block`,children:(0,l.jsx)(o,{active:`ladder`,leagueId:n})}),(0,l.jsxs)(`div`,{className:`lad-comp-toggle`,children:[i?(0,l.jsx)(r,{to:`/leagues/${n}/standings`,className:`lad-comp-btn`,children:`Main`}):(0,l.jsx)(`span`,{className:`lad-comp-btn active`,children:`Main`}),i?(0,l.jsx)(`span`,{className:`lad-comp-btn active`,children:`7s`}):(0,l.jsx)(r,{to:`/leagues/${n}/reserve7s/standings`,className:`lad-comp-btn`,children:`7s`})]}),S.length===0?(0,l.jsxs)(`div`,{className:`lad-empty`,children:[(0,l.jsx)(`i`,{className:`bi bi-bar-chart`}),(0,l.jsx)(`h4`,{children:`No teams yet`}),(0,l.jsx)(`p`,{children:`Teams will appear here once they join the league.`})]}):(0,l.jsxs)(l.Fragment,{children:[(0,l.jsxs)(`div`,{className:`lad-head`,children:[(0,l.jsx)(F,{field:`pos`,children:`#`}),(0,l.jsx)(F,{field:`name`,children:`Team`}),(0,l.jsx)(`span`,{children:`Status`}),(0,l.jsx)(F,{field:`pr`,children:`PR`}),(0,l.jsx)(F,{field:`wins`,children:`W–L`}),(0,l.jsx)(`span`,{children:`Form · 5`}),(0,l.jsx)(F,{field:`mov`,children:`Mov.`}),(0,l.jsx)(F,{field:`pf`,children:O.for_label}),(0,l.jsx)(F,{field:`pa`,children:O.against_label}),(0,l.jsx)(F,{field:`pct`,children:O.pct_label}),(0,l.jsx)(F,{field:`pts`,children:`Pts`})]}),(0,l.jsx)(`div`,{className:`lad-wrap`,children:E.map(e=>{let t=T.get(e.team_id)??0,i=w[e.team_id],a=k[String(e.team_id)],o=A[String(e.team_id)]||[],s=j!=null&&e.team_id===j,c=P&&t===D,u=d(e.team_id),p=i?.movement??0,m=a?.headline,h=f(m||``);return(0,l.jsxs)(`div`,{children:[(0,l.jsxs)(r,{to:`/leagues/${n}/team/${e.team_id}`,className:`lad-row${s?` mine`:``}`,style:{"--lad-accent":u.hex,"--lad-accent-rgb":u.rgb},children:[(0,l.jsx)(`span`,{className:`lad-rank${t<=3?` lad-rank-${t}`:``}`,children:t}),(0,l.jsx)(`span`,{className:`lad-team-name`,children:e.team?.name}),(0,l.jsx)(`span`,{className:`lad-status`,children:m?(0,l.jsx)(`span`,{className:`lad-pill lad-pill-${h}`,children:m}):(0,l.jsx)(`span`,{className:`lad-status-empty`,children:`—`})}),(0,l.jsx)(`span`,{className:`lad-pr`,children:i?.rank?(0,l.jsx)(`span`,{className:`lad-pr-chip${i.rank<=3?` tier-${i.rank}`:``}`,children:i.rank}):(0,l.jsx)(`span`,{className:`lad-pr-empty`,children:`—`})}),(0,l.jsxs)(`span`,{className:`lad-wl`,children:[(0,l.jsx)(`span`,{className:`w`,children:e.wins}),(0,l.jsx)(`span`,{className:`sep`,children:`–`}),(0,l.jsx)(`span`,{className:`l`,children:e.losses}),e.draws>0&&(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`span`,{className:`sep`,children:`–`}),(0,l.jsx)(`span`,{className:`d`,children:e.draws})]})]}),(0,l.jsx)(`div`,{className:`lad-form`,children:(o.length>0?o:[,,,,,].fill(``)).slice(-5).map((e,t)=>(0,l.jsx)(`span`,{className:`lad-form-dot ${e}`,title:e||`No result`},t))}),(0,l.jsxs)(`span`,{className:`lad-momentum ${p>0?`up`:p<0?`down`:`flat`}`,children:[p>0&&(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`i`,{className:`bi bi-caret-up-fill`,style:{fontSize:`.6rem`}}),p]}),p<0&&(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`i`,{className:`bi bi-caret-down-fill`,style:{fontSize:`.6rem`}}),Math.abs(p)]}),p===0&&(0,l.jsx)(l.Fragment,{children:`—`})]}),(0,l.jsx)(`span`,{className:`lad-num`,children:e.points_for>0?Math.round(e.points_for):`–`}),(0,l.jsx)(`span`,{className:`lad-num`,children:e.points_against>0?Math.round(e.points_against):`–`}),(0,l.jsx)(`span`,{className:`lad-num`,children:e.percentage>0?(0,l.jsxs)(`span`,{style:e.percentage>=110?{color:`#6db38a`}:e.percentage<90?{color:`#d68a7e`}:void 0,children:[e.percentage.toFixed(1),(0,l.jsx)(`span`,{className:`unit`,children:`%`})]}):`–`}),(0,l.jsx)(`span`,{className:`lad-num lad-num-strong`,children:e.ladder_points})]}),c&&(0,l.jsx)(`div`,{className:`lad-cut`,children:(0,l.jsxs)(`span`,{children:[(0,l.jsx)(`i`,{className:`bi bi-trophy-fill`}),`Finals cut · top `,D]})},`cut-${e.team_id}`)]},e.team_id)})}),(0,l.jsxs)(`div`,{className:`lad-foot`,children:[(0,l.jsx)(`span`,{children:M&&C[0]?`Round ${C[0].afl_round} · Form, momentum & headlines updated weekly`:``}),(0,l.jsx)(`span`,{className:`scoring-tag`,"data-type":N,children:O.label})]})]})]})}export{g as t};