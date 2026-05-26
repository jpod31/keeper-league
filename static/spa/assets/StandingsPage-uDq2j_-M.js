import{f as e,i as t,n,t as r}from"./Spinner-BZqcd_eb.js";import{t as i}from"./useFetch-k76LU9jk.js";import{t as a}from"./LeagueSubnav-DExbcoL5.js";var o=n(),s=[{hex:`#3a7dc4`,rgb:`58,125,196`},{hex:`#b87f3d`,rgb:`184,127,61`},{hex:`#8a6db8`,rgb:`138,109,184`},{hex:`#3d8c63`,rgb:`61,140,99`},{hex:`#c2932f`,rgb:`194,147,47`},{hex:`#b85a4a`,rgb:`184,90,74`},{hex:`#3d8a9c`,rgb:`61,138,156`},{hex:`#9d5878`,rgb:`157,88,120`}];function c(e){return s[(e||0)%s.length]}function l(e){return(e||`Steady`).toLowerCase().replace(/\s+/g,``)}function u(e){let t=(e||``).toLowerCase();return t.includes(`supercoach`)?`sc`:t.includes(`fantasy`)?`af`:t.includes(`ultimate`)?`uf`:t.includes(`hybrid`)?`hybrid`:`custom`}var d=`
.lad-wrap { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.lad-head {
  display: grid;
  grid-template-columns: 36px 1fr 130px 84px 88px 84px 60px;
  gap: 12px;
  align-items: center;
  padding: 0 16px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #6c7892;
  margin-bottom: 4px;
}
.lad-head > * { text-align: right; }
.lad-head > :nth-child(1), .lad-head > :nth-child(2) { text-align: left; }

.lad-row {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr 130px 84px 88px 84px 60px;
  gap: 12px;
  align-items: center;
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

/* Team column */
.lad-team {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.lad-team-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
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

.lad-team-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: .68rem;
  color: #97a3ba;
  font-variant-numeric: tabular-nums;
}
.lad-team-sub b { color: #c8d0e0; font-weight: 600; }
.lad-team-sub .sep { width: 3px; height: 3px; border-radius: 50%; background: #4a5471; }
.lad-team-sub .pos { color: #6db38a; }
.lad-team-sub .neg { color: #d68a7e; }

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

/* Mobile — switch to stacked card per row */
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
  .lad-row > .lad-form { grid-row: 2; grid-column: 1 / -1; justify-content: flex-start; }
  .lad-row > .lad-num:not(.lad-num-strong),
  .lad-row > .lad-momentum { display: none; }
}

/* Sevens mode — purple accent palette */
.lad-sevens .lad-form-dot.W { background: #8a6db8; }
.lad-sevens .lad-num-strong { color: #b39ed4; }
`;function f({mode:n=`main`}={}){let{leagueId:s}=e(),f=n===`sevens`,{data:p,loading:m}=i(f?`/leagues/${s}/reserve7s/standings?format=json`:`/leagues/${s}/standings?format=json`);if(m)return(0,o.jsx)(r,{text:`Loading standings...`});if(!p)return(0,o.jsx)(`p`,{className:`text-danger`,children:`Failed to load standings`});let{standings:h,finals_teams:g,scoring:_,rankings:v,ranking_details:y,team_form:b,user_team_id:x}=p,S=v&&v.length>0,C=u(_.label),w={};for(let e of v||[])w[e.team_id]=e;return(0,o.jsxs)(`div`,{className:f?`lad-sevens`:``,children:[(0,o.jsx)(`style`,{children:d}),(0,o.jsx)(`div`,{className:`d-none d-lg-block`,children:(0,o.jsx)(a,{active:`ladder`,leagueId:s})}),(0,o.jsxs)(`div`,{className:`lad-comp-toggle`,children:[f?(0,o.jsx)(t,{to:`/leagues/${s}/standings`,className:`lad-comp-btn`,children:`Main`}):(0,o.jsx)(`span`,{className:`lad-comp-btn active`,children:`Main`}),f?(0,o.jsx)(`span`,{className:`lad-comp-btn active`,children:`7s`}):(0,o.jsx)(t,{to:`/leagues/${s}/reserve7s/standings`,className:`lad-comp-btn`,children:`7s`})]}),h.length===0?(0,o.jsxs)(`div`,{className:`lad-empty`,children:[(0,o.jsx)(`i`,{className:`bi bi-bar-chart`}),(0,o.jsx)(`h4`,{children:`No teams yet`}),(0,o.jsx)(`p`,{children:`Teams will appear here once they join the league.`})]}):(0,o.jsxs)(o.Fragment,{children:[(0,o.jsxs)(`div`,{className:`lad-head`,children:[(0,o.jsx)(`span`,{children:`#`}),(0,o.jsx)(`span`,{children:`Team`}),(0,o.jsx)(`span`,{children:`Form · 5`}),(0,o.jsx)(`span`,{children:`Mov.`}),(0,o.jsx)(`span`,{children:_.for_label}),(0,o.jsx)(`span`,{children:_.pct_label}),(0,o.jsx)(`span`,{children:`Pts`})]}),(0,o.jsx)(`div`,{className:`lad-wrap`,children:h.map((e,n)=>{let r=n+1,i=w[e.team_id],a=i&&y[String(e.team_id)],u=b[String(e.team_id)]||[],d=x!=null&&e.team_id===x,f=g>0&&r===g,p=c(e.team_id),m=i?.movement??0,h=a?.headline,_=l(h||``);return(0,o.jsxs)(`div`,{children:[(0,o.jsxs)(t,{to:`/leagues/${s}/team/${e.team_id}`,className:`lad-row${d?` mine`:``}`,style:{"--lad-accent":p.hex,"--lad-accent-rgb":p.rgb},children:[(0,o.jsx)(`span`,{className:`lad-rank${r<=3?` lad-rank-${r}`:``}`,children:r}),(0,o.jsxs)(`div`,{className:`lad-team`,children:[(0,o.jsxs)(`div`,{className:`lad-team-row`,children:[(0,o.jsx)(`span`,{className:`lad-team-name`,children:e.team?.name}),h&&(0,o.jsx)(`span`,{className:`lad-pill lad-pill-${_}`,children:h})]}),(0,o.jsxs)(`div`,{className:`lad-team-sub`,children:[(0,o.jsxs)(`span`,{className:`lad-record`,children:[(0,o.jsxs)(`span`,{className:`w`,children:[e.wins,`W`]}),(0,o.jsxs)(`span`,{className:`l`,children:[e.losses,`L`]}),e.draws>0&&(0,o.jsxs)(`span`,{className:`d`,children:[e.draws,`D`]})]}),a&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(`span`,{className:`sep`}),(0,o.jsxs)(`span`,{children:[`Avg `,(0,o.jsx)(`b`,{children:a.avg_score})]}),(0,o.jsx)(`span`,{className:`sep`}),(0,o.jsxs)(`span`,{className:a.pct_above>0?`pos`:a.pct_above<0?`neg`:``,children:[a.pct_above>=0?`+`:``,a.pct_above.toFixed(1),`% vs lge`]})]})]})]}),(0,o.jsx)(`div`,{className:`lad-form`,children:(u.length>0?u:[,,,,,].fill(``)).slice(-5).map((e,t)=>(0,o.jsx)(`span`,{className:`lad-form-dot ${e}`,title:e||`No result`},t))}),(0,o.jsxs)(`span`,{className:`lad-momentum ${m>0?`up`:m<0?`down`:`flat`}`,children:[m>0&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(`i`,{className:`bi bi-caret-up-fill`,style:{fontSize:`.6rem`}}),m]}),m<0&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(`i`,{className:`bi bi-caret-down-fill`,style:{fontSize:`.6rem`}}),Math.abs(m)]}),m===0&&(0,o.jsx)(o.Fragment,{children:`—`})]}),(0,o.jsx)(`span`,{className:`lad-num`,children:e.points_for>0?Math.round(e.points_for):`–`}),(0,o.jsx)(`span`,{className:`lad-num`,children:e.percentage>0?(0,o.jsxs)(`span`,{style:e.percentage>=110?{color:`#6db38a`}:e.percentage<90?{color:`#d68a7e`}:void 0,children:[e.percentage.toFixed(1),(0,o.jsx)(`span`,{className:`unit`,children:`%`})]}):`–`}),(0,o.jsx)(`span`,{className:`lad-num lad-num-strong`,children:e.ladder_points})]}),f&&(0,o.jsx)(`div`,{className:`lad-cut`,children:(0,o.jsxs)(`span`,{children:[(0,o.jsx)(`i`,{className:`bi bi-trophy-fill`}),`Finals cut · top `,g]})},`cut-${e.team_id}`)]},e.team_id)})}),(0,o.jsxs)(`div`,{className:`lad-foot`,children:[(0,o.jsx)(`span`,{children:S&&v[0]?`Round ${v[0].afl_round} · Form, momentum & headlines updated weekly`:``}),(0,o.jsx)(`span`,{className:`scoring-tag`,"data-type":C,children:_.label})]})]})]})}export{f as t};