import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";import{n as r,u as i}from"./chunk-QFMPRPBF-tanTk093.js";import{t as a}from"./useFetch-C1BcNsh0.js";import{n as o,t as s}from"./TeamBadge-rPQCu1yA.js";import{t as c}from"./LeagueSubnav-Dr8mwNj7.js";var l=e(t(),1),u=n();function d(){return(0,u.jsxs)(`div`,{className:`stsk`,children:[(0,u.jsxs)(`div`,{className:`stsk-header`,children:[(0,u.jsx)(`span`,{className:`kl-skel stsk-title`}),(0,u.jsx)(`span`,{className:`kl-skel stsk-meta`})]}),(0,u.jsx)(`div`,{className:`stsk-list`,children:Array.from({length:10}).map((e,t)=>(0,u.jsxs)(`div`,{className:`stsk-row`,children:[(0,u.jsx)(`span`,{className:`kl-skel stsk-rank`}),(0,u.jsx)(`span`,{className:`kl-skel stsk-name`}),(0,u.jsx)(`span`,{className:`kl-skel stsk-cell`}),(0,u.jsx)(`span`,{className:`kl-skel stsk-cell`}),(0,u.jsx)(`span`,{className:`kl-skel stsk-cell`})]},t))})]})}function f(e){return(e||`Steady`).toLowerCase().replace(/\s+/g,``)}function p(e){let t=(e||``).toLowerCase();return t.includes(`supercoach`)?`sc`:t.includes(`fantasy`)?`af`:t.includes(`ultimate`)?`uf`:t.includes(`hybrid`)?`hybrid`:`custom`}var m=`
.lad-wrap { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
/* Grid: # | Team | Status | PR | W-L | Form | Mov | PF | PA | % | Pts */
.lad-head, .lad-row {
  display: grid;
  grid-template-columns: 36px 1fr 150px 52px 76px 110px 64px 70px 70px 68px 56px;
  gap: 10px;
  align-items: center;
}
.lad-head {
  padding: 0 16px;
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--kl-text-primary);
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
.lad-head button.lad-sort:hover { color: #e8e7f0; }
.lad-head .lad-sort-chev {
  font-size: .8125rem;
  opacity: .25;
  transition: opacity .14s ease, color .14s ease;
}
.lad-head .lad-sort.active { color: #ececf1; }
.lad-head .lad-sort.active .lad-sort-chev { opacity: 1; color: #e4e3ed; }
.lad-head > :nth-child(n+4) .lad-sort {
  justify-content: flex-end;
  width: 100%;
}

.lad-row {
  position: relative;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(19,19,22,.7);
  border: 1px solid rgba(220,218,231,.12);
  text-decoration: none;
  color: #ececf1;
  transition: background .14s ease, border-color .14s ease, transform .14s ease;
}
.lad-row:hover {
  background: rgba(25,24,28,.8);
  border-color: rgba(220,218,231,.22);
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
  background: var(--lad-accent, #b0b0bc);
  opacity: .65;
}
.lad-row.mine {
  background: rgba(var(--team, 224,222,234), .14);
  border-color: rgba(var(--team, 224,222,234), .6);
}
.lad-row.mine::before { width: 3px; opacity: 1; background: rgb(var(--team, 224,222,234)); }

/* Rank */
.lad-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 800;
  color: var(--kl-text-primary);
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  font-variant-numeric: tabular-nums;
}
.lad-rank-1 { color: #e8c25b; border-color: rgba(232,194,91,.4); background: rgba(232,194,91,.08); }
.lad-rank-2 { color: var(--kl-text-primary); border-color: rgba(189,187,199,.35); background: rgba(189,187,199,.06); }
.lad-rank-3 { color: #b8855d; border-color: rgba(184,133,93,.35); background: rgba(184,133,93,.06); }

/* Team column, just the name. Nothing else. */
.lad-team-name {
  font-size: .92rem;
  font-weight: 700;
  color: #f5f5f7;
  letter-spacing: -.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lad-pill {
  display: inline-flex;
  align-items: center;
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.lad-pill-onfire, .lad-pill-dominant { color: #6db38a; border-color: rgba(109,179,138,.4); background: rgba(109,179,138,.1); }
.lad-pill-surging, .lad-pill-strong { color: #e4e3ed; border-color: rgba(228,227,237,.4); background: rgba(228,227,237,.1); }
.lad-pill-steady { color: var(--kl-text-primary); border-color: rgba(191,190,197,.3); background: rgba(191,190,197,.06); }
.lad-pill-underperforming, .lad-pill-struggling { color: #d68a7e; border-color: rgba(214,138,126,.35); background: rgba(214,138,126,.08); }
.lad-pill-sliding, .lad-pill-infreefall { color: #e07a6c; border-color: rgba(224,122,108,.45); background: rgba(224,122,108,.12); }

/* W/L record column */
.lad-wl {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--kl-font);
  font-variant-numeric: tabular-nums;
  font-size: .82rem;
  font-weight: 700;
}
.lad-wl .w { color: #6db38a; }
.lad-wl .l { color: #d68a7e; }
.lad-wl .d { color: #c2932f; }
.lad-wl .sep { color: var(--kl-text-primary); font-weight: 400; }

/* Status column, empty when no headline */
.lad-status { display: flex; align-items: center; }
.lad-status-empty { color: var(--kl-text-primary); font-size: .8125rem; }

/* Power-rank chip, distinct from the ladder rank cell. Top 3 get medal
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
  font-family: var(--kl-font);
  font-variant-numeric: tabular-nums;
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: -.02em;
  background: linear-gradient(135deg, rgba(220,218,231,.10), rgba(220,218,231,.02));
  border: 1px solid rgba(220,218,231,.22);
  color: #e8e7f0;
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
  background: linear-gradient(135deg, rgba(210,209,217,.22), rgba(210,209,217,.06));
  border-color: rgba(210,209,217,.48);
  color: #e7e6eb;
}
.lad-pr-chip.tier-3 {
  background: linear-gradient(135deg, rgba(199,152,112,.24), rgba(199,152,112,.06));
  border-color: rgba(199,152,112,.5);
  color: #e0b48a;
}
.lad-pr-empty { color: var(--kl-text-primary); font-size: .82rem; }

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
  font-family: var(--kl-font);
  font-variant-numeric: tabular-nums;
  font-size: .8125rem;
  font-weight: 700;
  color: var(--kl-text-primary);
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,.03);
  min-width: 56px;
}
.lad-momentum.up { color: #6db38a; background: rgba(61,140,99,.1); }
.lad-momentum.down { color: #d68a7e; background: rgba(184,90,74,.1); }
.lad-momentum.flat { color: var(--kl-text-primary); }

/* Numeric columns */
.lad-num {
  font-family: var(--kl-font);
  font-variant-numeric: tabular-nums;
  font-size: .92rem;
  font-weight: 600;
  color: #ececf1;
  text-align: right;
}
.lad-num-strong { font-size: 1rem; font-weight: 800; color: #f5f5f7; }
.lad-num-muted { color: var(--kl-text-primary); }
.lad-num .unit {
  font-size: .8125rem;
  font-weight: 500;
  color: var(--kl-text-primary);
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
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: .06em;
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
  font-size: .8125rem;
  color: var(--kl-text-primary);
}
.lad-foot .scoring-tag {
  font-size: .8125rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(220,218,231,.25);
  background: rgba(19,19,22,.5);
  color: #e9e7f0;
}

/* Empty state */
.lad-empty { text-align: center; padding: 60px 20px; color: var(--kl-text-primary); }
.lad-empty i { font-size: 2rem; display: block; margin-bottom: 12px; color: #38363e; }
.lad-empty h4 { color: var(--kl-text-primary); font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
.lad-empty p { font-size: .82rem; margin: 0; }

/* Competition toggle */
.lad-comp-toggle {
  display: inline-flex;
  background: rgba(19,19,22,.5);
  border: 1px solid rgba(220,218,231,.18);
  border-radius: 999px;
  padding: 3px;
  margin-bottom: 16px;
}
.lad-comp-btn {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: .8125rem;
  font-weight: 700;
  color: var(--kl-text-primary);
  text-decoration: none;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.lad-comp-btn:hover { color: #ececf1; text-decoration: none; }
.lad-comp-btn.active {
  background: rgba(81,78,95,.18);
  color: #e4e3ed;
}
.lad-sevens .lad-comp-btn.active {
  background: rgba(221,219,232,.18);
  color: #e6e4ee;
}

.lad-team { display: flex; align-items: center; min-width: 0; }
.lad-team .lad-team-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Mobile, compact 3-column layout */
@media (max-width: 768px) {
  .lad-head { display: none; }
  .lad-row {
    grid-template-columns: 28px 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px 10px;
    padding: 12px 14px;
  }
  .lad-row > .lad-rank { grid-row: 1; grid-column: 1; }
  .lad-row > .lad-team { grid-row: 1; grid-column: 2; }
  .lad-row > .lad-num-strong { grid-row: 1; grid-column: 3; }
  .lad-row > .lad-status { grid-row: 2; grid-column: 2 / 4; justify-self: start; }
  .lad-row > .lad-form { grid-row: 2; grid-column: 1; justify-content: flex-start; }
  .lad-row > .lad-num:not(.lad-num-strong),
  .lad-row > .lad-pr,
  .lad-row > .lad-wl,
  .lad-row > .lad-momentum { display: none; }
}

/* Sevens mode, purple accent palette */
.lad-sevens .lad-form-dot.W { background: #dddbe8; }
.lad-sevens .lad-num-strong { color: #e6e4ee; }
`,h={pos:`asc`,name:`asc`,pr:`asc`,wins:`desc`,mov:`desc`,pf:`desc`,pa:`desc`,pct:`desc`,pts:`desc`};function g({mode:e=`main`}={}){let t=o(),{leagueId:n}=i(),g=e===`sevens`,{data:_,loading:v}=a(g?`/leagues/${n}/reserve7s/standings?format=json`:`/leagues/${n}/standings?format=json`),[y,b]=(0,l.useState)(`pos`),[x,S]=(0,l.useState)(`asc`);function C(e){e===y?S(e=>e===`asc`?`desc`:`asc`):(b(e),S(h[e]))}let w=_?.standings??[],T=_?.rankings??[],E=(0,l.useMemo)(()=>{let e={};for(let t of T)e[t.team_id]=t;return e},[T]),D=(0,l.useMemo)(()=>{let e=new Map;return w.forEach((t,n)=>e.set(t.team_id,n+1)),e},[w]),O=(0,l.useMemo)(()=>{let e=[...w];return e.sort((e,t)=>{let n=0,r=0;switch(y){case`pos`:n=D.get(e.team_id)??999,r=D.get(t.team_id)??999;break;case`name`:n=(e.team?.name||``).toLowerCase(),r=(t.team?.name||``).toLowerCase();break;case`pr`:n=E[e.team_id]?.rank??999,r=E[t.team_id]?.rank??999;break;case`wins`:n=e.wins*1e3-e.losses,r=t.wins*1e3-t.losses;break;case`mov`:n=E[e.team_id]?.movement??0,r=E[t.team_id]?.movement??0;break;case`pf`:n=e.points_for,r=t.points_for;break;case`pa`:n=e.points_against,r=t.points_against;break;case`pct`:n=e.percentage,r=t.percentage;break;case`pts`:n=e.ladder_points,r=t.ladder_points;break}let i=0;return i=typeof n==`string`&&typeof r==`string`?n.localeCompare(r):n-r,x===`asc`?i:-i}),e},[w,y,x,D,E]);if(v)return(0,u.jsx)(d,{});if(!_)return(0,u.jsx)(`p`,{className:`text-danger`,children:`Failed to load standings`});let{finals_teams:k,scoring:A,user_team_id:j}=_,M=_.ranking_details??{},N=_.team_form??{},P=T.length>0,F=p(A.label),I=y===`pos`&&x===`asc`&&k>0,L=({field:e,children:t})=>{let n=y===e;return(0,u.jsxs)(`button`,{type:`button`,className:`lad-sort${n?` active`:``}`,onClick:()=>C(e),children:[t,(0,u.jsx)(`span`,{className:`lad-sort-chev`,children:n?x===`asc`?`▲`:`▼`:`▾`})]})};return(0,u.jsxs)(`div`,{className:g?`lad-sevens`:``,children:[(0,u.jsx)(`style`,{children:m}),(0,u.jsx)(`div`,{className:`d-none d-lg-block`,children:(0,u.jsx)(c,{active:`ladder`,leagueId:n})}),(0,u.jsxs)(`div`,{className:`lad-comp-toggle`,children:[g?(0,u.jsx)(r,{to:`/leagues/${n}/standings`,className:`lad-comp-btn`,children:`Main`}):(0,u.jsx)(`span`,{className:`lad-comp-btn active`,children:`Main`}),g?(0,u.jsx)(`span`,{className:`lad-comp-btn active`,children:`7s`}):(0,u.jsx)(r,{to:`/leagues/${n}/reserve7s/standings`,className:`lad-comp-btn`,children:`7s`})]}),w.length===0?(0,u.jsxs)(`div`,{className:`lad-empty`,children:[(0,u.jsx)(`i`,{className:`bi bi-bar-chart`}),(0,u.jsx)(`h4`,{children:`No teams yet`}),(0,u.jsx)(`p`,{children:`Teams will appear here once they join the league.`})]}):(0,u.jsxs)(u.Fragment,{children:[(0,u.jsxs)(`div`,{className:`lad-head`,children:[(0,u.jsx)(L,{field:`pos`,children:`#`}),(0,u.jsx)(L,{field:`name`,children:`Team`}),(0,u.jsx)(`span`,{children:`Status`}),(0,u.jsx)(L,{field:`pr`,children:`PR`}),(0,u.jsx)(L,{field:`wins`,children:`W–L`}),(0,u.jsx)(`span`,{children:`Form`}),(0,u.jsx)(L,{field:`mov`,children:`Mov.`}),(0,u.jsx)(L,{field:`pf`,children:A.for_label}),(0,u.jsx)(L,{field:`pa`,children:A.against_label}),(0,u.jsx)(L,{field:`pct`,children:A.pct_label}),(0,u.jsx)(L,{field:`pts`,children:`Pts`})]}),(0,u.jsx)(`div`,{className:`lad-wrap`,children:O.map(e=>{let i=D.get(e.team_id)??0,a=E[e.team_id],o=M[String(e.team_id)],c=N[String(e.team_id)]||[],l=j!=null&&e.team_id===j,d=I&&i===k,p=t(e.team_id),m=a?.movement??0,h=o?.headline,g=f(h||``);return(0,u.jsxs)(`div`,{children:[(0,u.jsxs)(r,{to:`/leagues/${n}/team/${e.team_id}`,className:`lad-row${l?` mine`:``}`,style:{"--lad-accent":p.hex,"--lad-accent-rgb":p.rgb},children:[(0,u.jsx)(`span`,{className:`lad-rank${i<=3?` lad-rank-${i}`:``}`,children:i}),(0,u.jsxs)(`span`,{className:`lad-team`,children:[(0,u.jsx)(s,{name:e.team_id,size:28,showName:!1}),(0,u.jsx)(`span`,{className:`lad-team-name`,children:e.team?.name})]}),(0,u.jsx)(`span`,{className:`lad-status`,children:h?(0,u.jsx)(`span`,{className:`lad-pill lad-pill-${g}`,children:h}):(0,u.jsx)(`span`,{className:`lad-status-empty`,children:`-`})}),(0,u.jsx)(`span`,{className:`lad-pr`,children:a?.rank?(0,u.jsx)(`span`,{className:`lad-pr-chip${a.rank<=3?` tier-${a.rank}`:``}`,children:a.rank}):(0,u.jsx)(`span`,{className:`lad-pr-empty`,children:`-`})}),(0,u.jsxs)(`span`,{className:`lad-wl`,children:[(0,u.jsx)(`span`,{className:`w`,children:e.wins}),(0,u.jsx)(`span`,{className:`sep`,children:`–`}),(0,u.jsx)(`span`,{className:`l`,children:e.losses}),e.draws>0&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`span`,{className:`sep`,children:`–`}),(0,u.jsx)(`span`,{className:`d`,children:e.draws})]})]}),(0,u.jsx)(`div`,{className:`lad-form`,children:(c.length>0?c:[,,,,,].fill(``)).slice(-5).map((e,t)=>(0,u.jsx)(`span`,{className:`lad-form-dot ${e}`,title:e||`No result`},t))}),(0,u.jsxs)(`span`,{className:`lad-momentum ${m>0?`up`:m<0?`down`:`flat`}`,children:[m>0&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`i`,{className:`bi bi-caret-up-fill`,style:{fontSize:`.8125rem`}}),m]}),m<0&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`i`,{className:`bi bi-caret-down-fill`,style:{fontSize:`.8125rem`}}),Math.abs(m)]}),m===0&&(0,u.jsx)(u.Fragment,{children:`-`})]}),(0,u.jsx)(`span`,{className:`lad-num`,children:e.points_for>0?Math.round(e.points_for):`–`}),(0,u.jsx)(`span`,{className:`lad-num`,children:e.points_against>0?Math.round(e.points_against):`–`}),(0,u.jsx)(`span`,{className:`lad-num`,children:e.percentage>0?(0,u.jsxs)(`span`,{style:e.percentage>=110?{color:`#6db38a`}:e.percentage<90?{color:`#d68a7e`}:void 0,children:[e.percentage.toFixed(1),(0,u.jsx)(`span`,{className:`unit`,children:`%`})]}):`–`}),(0,u.jsx)(`span`,{className:`lad-num lad-num-strong`,children:e.ladder_points})]}),d&&(0,u.jsx)(`div`,{className:`lad-cut`,children:(0,u.jsxs)(`span`,{children:[(0,u.jsx)(`i`,{className:`bi bi-trophy-fill`}),`Finals cut, top `,k]})},`cut-${e.team_id}`)]},e.team_id)})}),(0,u.jsxs)(`div`,{className:`lad-foot`,children:[(0,u.jsx)(`span`,{children:P&&T[0]?`After round ${T[0].afl_round}`:``}),(0,u.jsx)(`span`,{className:`scoring-tag`,"data-type":F,children:A.label})]})]})]})}export{g as t};