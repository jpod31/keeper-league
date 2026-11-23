import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";import{n as r,u as i}from"./chunk-QFMPRPBF-tanTk093.js";import{t as a}from"./useFetch-DtmO9Zkn.js";import{t as o}from"./LeagueSubnav-BmRpTufC.js";var s=e(t(),1),c=n();function l(){return(0,c.jsxs)(`div`,{className:`stsk`,children:[(0,c.jsxs)(`div`,{className:`stsk-header`,children:[(0,c.jsx)(`span`,{className:`kl-skel stsk-title`}),(0,c.jsx)(`span`,{className:`kl-skel stsk-meta`})]}),(0,c.jsx)(`div`,{className:`stsk-list`,children:Array.from({length:10}).map((e,t)=>(0,c.jsxs)(`div`,{className:`stsk-row`,children:[(0,c.jsx)(`span`,{className:`kl-skel stsk-rank`}),(0,c.jsx)(`span`,{className:`kl-skel stsk-name`}),(0,c.jsx)(`span`,{className:`kl-skel stsk-cell`}),(0,c.jsx)(`span`,{className:`kl-skel stsk-cell`}),(0,c.jsx)(`span`,{className:`kl-skel stsk-cell`})]},t))})]})}var u=[{hex:`#99722d`,rgb:`153,114,45`},{hex:`#b8733d`,rgb:`184,115,61`},{hex:`#ae9259`,rgb:`174,146,89`},{hex:`#876e3b`,rgb:`135,110,59`},{hex:`#c26a2f`,rgb:`194,106,47`},{hex:`#b85a4a`,rgb:`184,90,74`},{hex:`#8f6f38`,rgb:`143,111,56`},{hex:`#9d5878`,rgb:`157,88,120`}];function d(e){return u[(e||0)%u.length]}function f(e){return(e||`Steady`).toLowerCase().replace(/\s+/g,``)}function p(e){let t=(e||``).toLowerCase();return t.includes(`supercoach`)?`sc`:t.includes(`fantasy`)?`af`:t.includes(`ultimate`)?`uf`:t.includes(`hybrid`)?`hybrid`:`custom`}var m=`
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
  color: #888076;
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
.lad-head button.lad-sort:hover { color: #c4b79d; }
.lad-head .lad-sort-chev {
  font-size: .55rem;
  opacity: .25;
  transition: opacity .14s ease, color .14s ease;
}
.lad-head .lad-sort.active { color: #eae7e4; }
.lad-head .lad-sort.active .lad-sort-chev { opacity: 1; color: #deb565; }
.lad-head > :nth-child(n+4) .lad-sort {
  justify-content: flex-end;
  width: 100%;
}

.lad-row {
  position: relative;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(26,24,22,.7);
  border: 1px solid rgba(170,144,91,.12);
  text-decoration: none;
  color: #eae7e4;
  transition: background .14s ease, border-color .14s ease, transform .14s ease;
}
.lad-row:hover {
  background: rgba(33,31,28,.8);
  border-color: rgba(170,144,91,.22);
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
  background: var(--lad-accent, #b5a99c);
  opacity: .65;
}
.lad-row.mine {
  background: linear-gradient(90deg, rgba(var(--lad-accent-rgb, 186,157,100), .14), rgba(var(--lad-accent-rgb, 186,157,100), .04) 60%, transparent);
  border-color: rgba(var(--lad-accent-rgb, 186,157,100), .35);
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
  color: #d1cac3;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  font-variant-numeric: tabular-nums;
}
.lad-rank-1 { color: #e8935b; border-color: rgba(232,147,91,.4); background: rgba(232,147,91,.08); }
.lad-rank-2 { color: #cac2b8; border-color: rgba(202,194,184,.35); background: rgba(202,194,184,.06); }
.lad-rank-3 { color: #b87c5d; border-color: rgba(184,124,93,.35); background: rgba(184,124,93,.06); }

/* Team column — just the name. Nothing else. */
.lad-team-name {
  font-size: .92rem;
  font-weight: 700;
  color: #f7f6f5;
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
.lad-pill-onfire, .lad-pill-dominant { color: #cec7a1; border-color: rgba(206,199,161,.4); background: rgba(206,199,161,.1); }
.lad-pill-surging, .lad-pill-strong { color: #deb565; border-color: rgba(222,181,101,.4); background: rgba(222,181,101,.1); }
.lad-pill-steady { color: #b6ab9f; border-color: rgba(182,171,159,.3); background: rgba(182,171,159,.06); }
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
.lad-wl .w { color: #cec7a1; }
.lad-wl .l { color: #d68a7e; }
.lad-wl .d { color: #c26a2f; }
.lad-wl .sep { color: #645e57; font-weight: 400; }

/* Status column — empty when no headline */
.lad-status { display: flex; align-items: center; }
.lad-status-empty { color: #645e57; font-size: .68rem; }

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
  background: linear-gradient(135deg, rgba(170,144,91,.10), rgba(170,144,91,.02));
  border: 1px solid rgba(170,144,91,.22);
  color: #c4b79d;
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
  background: linear-gradient(135deg, rgba(232,147,91,.28), rgba(232,147,91,.06));
  border-color: rgba(232,147,91,.55);
  color: #f0a97a;
  box-shadow: 0 0 14px -2px rgba(232,147,91,.4);
}
.lad-pr-chip.tier-2 {
  background: linear-gradient(135deg, rgba(219,213,207,.22), rgba(219,213,207,.06));
  border-color: rgba(219,213,207,.48);
  color: #ece9e5;
}
.lad-pr-chip.tier-3 {
  background: linear-gradient(135deg, rgba(199,143,112,.24), rgba(199,143,112,.06));
  border-color: rgba(199,143,112,.5);
  color: #e0ab8a;
}
.lad-pr-empty { color: #645e57; font-size: .82rem; }

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
.lad-form-dot.W { background: #876e3b; }
.lad-form-dot.L { background: #b85a4a; }
.lad-form-dot.D { background: #c26a2f; }

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
  color: #b5a99c;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,.03);
  min-width: 56px;
}
.lad-momentum.up { color: #cec7a1; background: rgba(135,110,59,.1); }
.lad-momentum.down { color: #d68a7e; background: rgba(184,90,74,.1); }
.lad-momentum.flat { color: #888076; }

/* Numeric columns */
.lad-num {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .92rem;
  font-weight: 600;
  color: #eae7e4;
  text-align: right;
}
.lad-num-strong { font-size: 1rem; font-weight: 800; color: #f7f6f5; }
.lad-num-muted { color: #b5a99c; }
.lad-num .unit {
  font-size: .68rem;
  font-weight: 500;
  color: #888076;
  margin-left: 2px;
}

.lad-record { display: inline-flex; gap: 4px; align-items: baseline; }
.lad-record .w { color: #cec7a1; }
.lad-record .l { color: #d68a7e; }
.lad-record .d { color: #c26a2f; }

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
  color: rgba(206,199,161,.65);
}
.lad-cut::before, .lad-cut::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(206,199,161,.35), transparent);
}
.lad-cut span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(135,110,59,.08);
  border: 1px solid rgba(135,110,59,.25);
}

/* Footer */
.lad-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px 4px;
  font-size: .68rem;
  color: #888076;
}
.lad-foot .scoring-tag {
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(170,144,91,.25);
  background: rgba(26,24,22,.5);
  color: #c5b89f;
}

/* Empty state */
.lad-empty { text-align: center; padding: 60px 20px; color: #645e57; }
.lad-empty i { font-size: 2rem; display: block; margin-bottom: 12px; color: #494540; }
.lad-empty h4 { color: #b5a99c; font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
.lad-empty p { font-size: .82rem; margin: 0; }

/* Competition toggle */
.lad-comp-toggle {
  display: inline-flex;
  background: rgba(26,24,22,.5);
  border: 1px solid rgba(170,144,91,.18);
  border-radius: 999px;
  padding: 3px;
  margin-bottom: 16px;
}
.lad-comp-btn {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: .74rem;
  font-weight: 700;
  color: #b5a99c;
  text-decoration: none;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.lad-comp-btn:hover { color: #eae7e4; text-decoration: none; }
.lad-comp-btn.active {
  background: rgba(153,114,45,.18);
  color: #deb565;
}
.lad-sevens .lad-comp-btn.active {
  background: rgba(174,146,89,.18);
  color: #c9b284;
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
.lad-sevens .lad-form-dot.W { background: #ae9259; }
.lad-sevens .lad-num-strong { color: #c9b284; }
`,h={pos:`asc`,name:`asc`,pr:`asc`,wins:`desc`,mov:`desc`,pf:`desc`,pa:`desc`,pct:`desc`,pts:`desc`};function g({mode:e=`main`}={}){let{leagueId:t}=i(),n=e===`sevens`,{data:u,loading:g}=a(n?`/leagues/${t}/reserve7s/standings?format=json`:`/leagues/${t}/standings?format=json`),[_,v]=(0,s.useState)(`pos`),[y,b]=(0,s.useState)(`asc`);function x(e){e===_?b(e=>e===`asc`?`desc`:`asc`):(v(e),b(h[e]))}let S=u?.standings??[],C=u?.rankings??[],w=(0,s.useMemo)(()=>{let e={};for(let t of C)e[t.team_id]=t;return e},[C]),T=(0,s.useMemo)(()=>{let e=new Map;return S.forEach((t,n)=>e.set(t.team_id,n+1)),e},[S]),E=(0,s.useMemo)(()=>{let e=[...S];return e.sort((e,t)=>{let n=0,r=0;switch(_){case`pos`:n=T.get(e.team_id)??999,r=T.get(t.team_id)??999;break;case`name`:n=(e.team?.name||``).toLowerCase(),r=(t.team?.name||``).toLowerCase();break;case`pr`:n=w[e.team_id]?.rank??999,r=w[t.team_id]?.rank??999;break;case`wins`:n=e.wins*1e3-e.losses,r=t.wins*1e3-t.losses;break;case`mov`:n=w[e.team_id]?.movement??0,r=w[t.team_id]?.movement??0;break;case`pf`:n=e.points_for,r=t.points_for;break;case`pa`:n=e.points_against,r=t.points_against;break;case`pct`:n=e.percentage,r=t.percentage;break;case`pts`:n=e.ladder_points,r=t.ladder_points;break}let i=0;return i=typeof n==`string`&&typeof r==`string`?n.localeCompare(r):n-r,y===`asc`?i:-i}),e},[S,_,y,T,w]);if(g)return(0,c.jsx)(l,{});if(!u)return(0,c.jsx)(`p`,{className:`text-danger`,children:`Failed to load standings`});let{finals_teams:D,scoring:O,user_team_id:k}=u,A=u.ranking_details??{},j=u.team_form??{},M=C.length>0,N=p(O.label),P=_===`pos`&&y===`asc`&&D>0,F=({field:e,children:t})=>{let n=_===e;return(0,c.jsxs)(`button`,{type:`button`,className:`lad-sort${n?` active`:``}`,onClick:()=>x(e),children:[t,(0,c.jsx)(`span`,{className:`lad-sort-chev`,children:n?y===`asc`?`▲`:`▼`:`▾`})]})};return(0,c.jsxs)(`div`,{className:n?`lad-sevens`:``,children:[(0,c.jsx)(`style`,{children:m}),(0,c.jsx)(`div`,{className:`d-none d-lg-block`,children:(0,c.jsx)(o,{active:`ladder`,leagueId:t})}),(0,c.jsxs)(`div`,{className:`lad-comp-toggle`,children:[n?(0,c.jsx)(r,{to:`/leagues/${t}/standings`,className:`lad-comp-btn`,children:`Main`}):(0,c.jsx)(`span`,{className:`lad-comp-btn active`,children:`Main`}),n?(0,c.jsx)(`span`,{className:`lad-comp-btn active`,children:`7s`}):(0,c.jsx)(r,{to:`/leagues/${t}/reserve7s/standings`,className:`lad-comp-btn`,children:`7s`})]}),S.length===0?(0,c.jsxs)(`div`,{className:`lad-empty`,children:[(0,c.jsx)(`i`,{className:`bi bi-bar-chart`}),(0,c.jsx)(`h4`,{children:`No teams yet`}),(0,c.jsx)(`p`,{children:`Teams will appear here once they join the league.`})]}):(0,c.jsxs)(c.Fragment,{children:[(0,c.jsxs)(`div`,{className:`lad-head`,children:[(0,c.jsx)(F,{field:`pos`,children:`#`}),(0,c.jsx)(F,{field:`name`,children:`Team`}),(0,c.jsx)(`span`,{children:`Status`}),(0,c.jsx)(F,{field:`pr`,children:`PR`}),(0,c.jsx)(F,{field:`wins`,children:`W–L`}),(0,c.jsx)(`span`,{children:`Form · 5`}),(0,c.jsx)(F,{field:`mov`,children:`Mov.`}),(0,c.jsx)(F,{field:`pf`,children:O.for_label}),(0,c.jsx)(F,{field:`pa`,children:O.against_label}),(0,c.jsx)(F,{field:`pct`,children:O.pct_label}),(0,c.jsx)(F,{field:`pts`,children:`Pts`})]}),(0,c.jsx)(`div`,{className:`lad-wrap`,children:E.map(e=>{let n=T.get(e.team_id)??0,i=w[e.team_id],a=A[String(e.team_id)],o=j[String(e.team_id)]||[],s=k!=null&&e.team_id===k,l=P&&n===D,u=d(e.team_id),p=i?.movement??0,m=a?.headline,h=f(m||``);return(0,c.jsxs)(`div`,{children:[(0,c.jsxs)(r,{to:`/leagues/${t}/team/${e.team_id}`,className:`lad-row${s?` mine`:``}`,style:{"--lad-accent":u.hex,"--lad-accent-rgb":u.rgb},children:[(0,c.jsx)(`span`,{className:`lad-rank${n<=3?` lad-rank-${n}`:``}`,children:n}),(0,c.jsx)(`span`,{className:`lad-team-name`,children:e.team?.name}),(0,c.jsx)(`span`,{className:`lad-status`,children:m?(0,c.jsx)(`span`,{className:`lad-pill lad-pill-${h}`,children:m}):(0,c.jsx)(`span`,{className:`lad-status-empty`,children:`—`})}),(0,c.jsx)(`span`,{className:`lad-pr`,children:i?.rank?(0,c.jsx)(`span`,{className:`lad-pr-chip${i.rank<=3?` tier-${i.rank}`:``}`,children:i.rank}):(0,c.jsx)(`span`,{className:`lad-pr-empty`,children:`—`})}),(0,c.jsxs)(`span`,{className:`lad-wl`,children:[(0,c.jsx)(`span`,{className:`w`,children:e.wins}),(0,c.jsx)(`span`,{className:`sep`,children:`–`}),(0,c.jsx)(`span`,{className:`l`,children:e.losses}),e.draws>0&&(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)(`span`,{className:`sep`,children:`–`}),(0,c.jsx)(`span`,{className:`d`,children:e.draws})]})]}),(0,c.jsx)(`div`,{className:`lad-form`,children:(o.length>0?o:[,,,,,].fill(``)).slice(-5).map((e,t)=>(0,c.jsx)(`span`,{className:`lad-form-dot ${e}`,title:e||`No result`},t))}),(0,c.jsxs)(`span`,{className:`lad-momentum ${p>0?`up`:p<0?`down`:`flat`}`,children:[p>0&&(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)(`i`,{className:`bi bi-caret-up-fill`,style:{fontSize:`.6rem`}}),p]}),p<0&&(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)(`i`,{className:`bi bi-caret-down-fill`,style:{fontSize:`.6rem`}}),Math.abs(p)]}),p===0&&(0,c.jsx)(c.Fragment,{children:`—`})]}),(0,c.jsx)(`span`,{className:`lad-num`,children:e.points_for>0?Math.round(e.points_for):`–`}),(0,c.jsx)(`span`,{className:`lad-num`,children:e.points_against>0?Math.round(e.points_against):`–`}),(0,c.jsx)(`span`,{className:`lad-num`,children:e.percentage>0?(0,c.jsxs)(`span`,{style:e.percentage>=110?{color:`#cec7a1`}:e.percentage<90?{color:`#d68a7e`}:void 0,children:[e.percentage.toFixed(1),(0,c.jsx)(`span`,{className:`unit`,children:`%`})]}):`–`}),(0,c.jsx)(`span`,{className:`lad-num lad-num-strong`,children:e.ladder_points})]}),l&&(0,c.jsx)(`div`,{className:`lad-cut`,children:(0,c.jsxs)(`span`,{children:[(0,c.jsx)(`i`,{className:`bi bi-trophy-fill`}),`Finals cut · top `,D]})},`cut-${e.team_id}`)]},e.team_id)})}),(0,c.jsxs)(`div`,{className:`lad-foot`,children:[(0,c.jsx)(`span`,{children:M&&C[0]?`Round ${C[0].afl_round} · Form, momentum & headlines updated weekly`:``}),(0,c.jsx)(`span`,{className:`scoring-tag`,"data-type":N,children:O.label})]})]})]})}export{g as t};