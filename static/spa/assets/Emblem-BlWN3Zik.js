import{a as e}from"./chunk-BEqpzyXh.js";import{n as t,t as n}from"./jsx-runtime-BwJb0T-f.js";var r=e(t(),1),i=n(),a={gold:[`#fff8d6`,`#f4cf6a`,`#c08a26`,`#6b4309`],silver:[`#ffffff`,`#e4e8ee`,`#a3aab6`,`#4a505b`],bronze:[`#ffe2c4`,`#e0a067`,`#a3632b`,`#4f2c0d`],plat:[`#ffffff`,`#e8f6fa`,`#a9cdd6`,`#46707a`],black:[`#b9b9c4`,`#5a5a64`,`#26262d`,`#0b0b0d`]},o={gold:{m:`gold`,base:[`#2c2c33`,`#0b0b0e`]},plat:{m:`plat`,base:[`#2c2c33`,`#0b0b0e`]},ruby:{m:`gold`,base:[`#6e1424`,`#2a050c`]},sapph:{m:`plat`,base:[`#143a86`,`#06142f`]},black:{m:`black`,base:[`#1a1a1f`,`#020203`],gold:!0},silver:{m:`silver`,base:[`#2c2c33`,`#0b0b0e`]},bronze:{m:`bronze`,base:[`#2c2c33`,`#0b0b0e`]}};function s(e,t){let n=o[t],r=a[n.m],i=n.gold?a.gold:r;return`<defs>
  <linearGradient id="c${e}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${r[3]}"/><stop offset=".16" stop-color="${r[2]}"/><stop offset=".36" stop-color="${r[1]}"/><stop offset=".47" stop-color="${r[0]}"/><stop offset=".58" stop-color="${r[1]}"/><stop offset=".84" stop-color="${r[2]}"/><stop offset="1" stop-color="${r[3]}"/></linearGradient>
  <linearGradient id="f${e}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${i[0]}"/><stop offset=".35" stop-color="${i[1]}"/><stop offset=".72" stop-color="${i[2]}"/><stop offset="1" stop-color="${i[3]}"/></linearGradient>
  <linearGradient id="d${e}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r[2]}"/><stop offset="1" stop-color="${r[3]}"/></linearGradient>
  <radialGradient id="r${e}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${r[0]}"/><stop offset=".35" stop-color="${r[1]}"/><stop offset=".8" stop-color="${r[2]}"/><stop offset="1" stop-color="${r[3]}"/></radialGradient>
  <linearGradient id="b${e}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${n.base[0]}"/><stop offset="1" stop-color="${n.base[1]}"/></linearGradient>
  <linearGradient id="p${e}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#d6c4ff"/><stop offset=".4" stop-color="#9461ff"/><stop offset="1" stop-color="#4a17a8"/></linearGradient>
  </defs>`}var c=`stroke="#000" stroke-opacity=".4" stroke-width=".7"`,l=`font-family="Geist,system-ui,sans-serif" font-weight="900"`;function u(e,t,n,r,i=15){let a=t-r/2;return`<ellipse cx="${t}" cy="${n+i+1.5}" rx="${r/2+2}" ry="2.6" fill="#000" opacity=".55"/>
  <rect x="${a+5}" y="${n-5}" width="${r-10}" height="6" rx="1.2" fill="url(#b${e})"/>
  <rect x="${a+5}" y="${n-5}" width="${r-10}" height="1.2" fill="#fff" opacity=".18"/>
  <rect x="${a}" y="${n}" width="${r}" height="${i}" rx="2" fill="url(#b${e})"/>
  <rect x="${a}" y="${n}" width="${r}" height="1.4" fill="#fff" opacity=".2"/>
  <rect x="${t-12}" y="${n+4.5}" width="24" height="${i-9}" rx="1" fill="url(#f${e})"/>`}function d(e,t,n,r,i=5,a=-90){let o=[];for(let s=0;s<i*2;s++){let c=(a+s*180/i)*Math.PI/180,l=s%2?r:n;o.push([e+l*Math.cos(c),t+l*Math.sin(c)])}return o}var f=e=>e.map(e=>e[0].toFixed(2)+`,`+e[1].toFixed(2)).join(` `);function p(e,t,n,r,i,a=5){let o=d(t,n,r,i,a),s=``;for(let r=0;r<o.length;r++){let i=o[r],a=o[(r+1)%o.length];s+=`<polygon points="${f([[t,n],i,a])}" fill="${r%2?`url(#d${e})`:`url(#f${e})`}"/>`}return s+`<polygon points="${f(o)}" fill="none" ${c}/>`}function m(e,t,n,r,i,a,o,s){let l=``;for(let u=0;u<o;u++){let d=(i+(a-i)*u/(o-1))*Math.PI/180,f=t+r*Math.cos(d),p=n+r*Math.sin(d),m=d*180/Math.PI+(s>0?50:130);l+=`<ellipse cx="${f.toFixed(2)}" cy="${p.toFixed(2)}" rx="2.6" ry="6" transform="rotate(${m.toFixed(1)} ${f.toFixed(2)} ${p.toFixed(2)})" fill="url(#f${e})" ${c}/>`}return l}function h(e,t,n,r,i,a,o){return`<g transform="rotate(${a} ${t} ${n})">
    <ellipse cx="${t}" cy="${n}" rx="${r}" ry="${i}" fill="${o||`url(#r${e})`}" ${c}/>
    <path d="M${t-r*.92} ${n} Q${t} ${n-i*.32} ${t+r*.92} ${n}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>
    ${[-.35,-.17,0,.17,.35].map(e=>`<path d="M${t+r*e} ${n-i*.22-2.6} v5" stroke="#fff" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round"/>`).join(``)}
    <ellipse cx="${t-r*.3}" cy="${n-i*.45}" rx="${r*.35}" ry="${i*.16}" fill="#fff" opacity=".35"/></g>`}function g(e,t,n,r=1){return`<g transform="translate(${t} ${n}) scale(${r}) translate(-60 -8)">
    <path d="M37 33 C21 31 19 55 41 59" fill="none" stroke="url(#c${e})" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M83 33 C99 31 101 55 79 59" fill="none" stroke="url(#c${e})" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M37 33 C21 31 19 55 41 59 M83 33 C99 31 101 55 79 59" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.1"/>
    <path d="M44 93 C46 87 53 85 56 80 H64 C67 85 74 87 76 93 Z" fill="url(#c${e})" ${c}/>
    <rect x="56.5" y="66" width="7" height="15" fill="url(#c${e})"/>
    <ellipse cx="60" cy="74" rx="6.5" ry="2.8" fill="url(#c${e})" ${c}/>
    <path d="M36 30 H84 C84 50 76 63 60 67 C44 63 36 50 36 30 Z" fill="url(#c${e})" ${c}/>
    <path d="M37.6 41 H82.4" stroke="url(#f${e})" stroke-width="2.4"/>
    <path d="M38.5 44 H81.5" stroke="#000" stroke-opacity=".25" stroke-width=".8"/>
    <ellipse cx="60" cy="30" rx="24" ry="4.6" fill="url(#f${e})" ${c}/>
    <path d="M41 29 C43 20 51 16 60 16 C69 16 77 20 79 29 Z" fill="url(#c${e})" ${c}/>
    <ellipse cx="60" cy="29" rx="19" ry="2.4" fill="url(#f${e})"/>
    <rect x="58.6" y="8" width="2.8" height="9" fill="url(#c${e})"/>
    <circle cx="60" cy="7" r="3.6" fill="url(#r${e})" ${c}/>
    <path d="M43 34 C43 48 48 58 55 63" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/></g>`}var _={flag:e=>u(e,60,99,52)+g(e,60,8),keepermedal:e=>`
    <path d="M40 13 H80 L75 54 H45 Z" fill="#111116"/>
    <path d="M47 13 L50.5 54 M73 13 L69.5 54" stroke="url(#f${e})" stroke-width="3.4"/>
    <path d="M45 54 L60 62 L75 54 Z" fill="#050507"/>
    <rect x="34" y="4" width="52" height="10" rx="2.5" fill="url(#f${e})" ${c}/>
    <circle cx="34" cy="9" r="5" fill="url(#r${e})" ${c}/><circle cx="86" cy="9" r="5" fill="url(#r${e})" ${c}/>
    <circle cx="60" cy="61" r="5.5" fill="none" stroke="url(#f${e})" stroke-width="3"/>
    <circle cx="60" cy="90" r="27" fill="#000" opacity=".5" transform="translate(0 2)"/>
    <circle cx="60" cy="90" r="27" fill="url(#r${e})" ${c}/>
    <circle cx="60" cy="90" r="22.5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>
    <circle cx="60" cy="90" r="24.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>
    ${m(e,60,90,17,110,200,5,-1)}${m(e,60,90,17,70,-20,5,1)}
    ${h(e,60,88,10,6.5,-28,`url(#f${e})`)}`,sevensmedal:e=>`
    <path d="M40 13 H80 L75 54 H45 Z" fill="#6d3df0"/>
    <path d="M52 13 L54 54 M68 13 L66 54" stroke="#ffffff" stroke-width="4"/>
    <path d="M45 54 L60 62 L75 54 Z" fill="#3a1597"/>
    <rect x="34" y="4" width="52" height="10" rx="2.5" fill="url(#f${e})" ${c}/>
    <circle cx="60" cy="61" r="5.5" fill="none" stroke="url(#f${e})" stroke-width="3"/>
    <polygon points="${f(d(60,90,30,19,7))}" fill="#000" opacity=".5" transform="translate(0 2)"/>
    ${p(e,60,90,30,19,7)}
    <circle cx="60" cy="90" r="12" fill="url(#r${e})" ${c}/>`,champion:e=>`
    <rect x="22" y="6" width="76" height="108" rx="11" fill="#000" opacity=".5" transform="translate(0 3)"/>
    <rect x="22" y="6" width="76" height="108" rx="11" fill="url(#b${e})"/>
    <rect x="27" y="11" width="66" height="98" rx="8" fill="none" stroke="url(#f${e})" stroke-width="1.3" opacity=".8"/>
    <path d="M60 20 L86 28 V56 C86 74 75 86 60 94 C45 86 34 74 34 56 V28 Z" fill="url(#c${e})" ${c}/>
    <path d="M60 27 L80 33 V56 C80 70 72 80 60 87 C48 80 40 70 40 56 V33 Z" fill="url(#d${e})" opacity=".55"/>
    <path d="M40 58 L60 46 L80 58 V64 L60 52 L40 64 Z" fill="url(#f${e})" ${c}/>
    <polygon points="${f(d(60,72,7.5,3.1))}" fill="url(#f${e})" ${c}/>
    <rect x="44" y="99" width="32" height="6" rx="1" fill="url(#f${e})"/>`,allleague:e=>`
    <path d="M28 28 L46 18 L60 34 L74 18 L92 28 L100 110 H20 Z" fill="#000" opacity=".5" transform="translate(0 3)"/>
    <path d="M28 28 L46 18 L60 34 L74 18 L92 28 L100 110 H20 Z" fill="#15151b"/>
    <path d="M28 28 L46 18 L60 34 L74 18 L92 28 L100 110 H20 Z" fill="none" stroke="url(#f${e})" stroke-width="2"/>
    <path d="M49 19 L60 33 L71 19 Z" fill="#ececf1"/>
    <path d="M57.5 26 L62.5 26 L64 60 L60 66 L56 60 Z" fill="url(#c${e})"/>
    <path d="M46 18 L54 64 L60 34 Z" fill="#0a0a0e" stroke="url(#f${e})" stroke-width="1.2"/>
    <path d="M74 18 L66 64 L60 34 Z" fill="#0a0a0e" stroke="url(#f${e})" stroke-width="1.2"/>
    <path d="M68 50 H90 V66 C90 73 85 78 79 80 C73 78 68 73 68 66 Z" fill="url(#f${e})" ${c}/>
    <text x="79" y="71" text-anchor="middle" ${l} font-size="13" fill="#15151b">23</text>
    <circle cx="60" cy="76" r="2.4" fill="url(#r${e})"/><circle cx="60" cy="90" r="2.4" fill="url(#r${e})"/>`,rising:e=>u(e,60,101,38)+`
    <rect x="57" y="66" width="6" height="35" fill="url(#c${e})"/>
    <ellipse cx="60" cy="67" rx="7" ry="2.2" fill="url(#f${e})"/>
    <polygon points="${f(d(60,39,33,14))}" fill="#000" opacity=".45" transform="translate(0 2.5)"/>
    ${p(e,60,39,33,14)}`,siren:e=>u(e,60,101,40)+`
    <rect x="56.5" y="60" width="7" height="41" fill="url(#c${e})"/>
    <path d="M38 62 L52 54 L83 25 C91 28 96 38 94 47 L60 63 L46 68 Z" fill="url(#c${e})" ${c}/>
    <ellipse cx="89" cy="36" rx="7" ry="12.5" transform="rotate(-38 89 36)" fill="url(#d${e})" ${c}/>
    <ellipse cx="89" cy="36" rx="4.2" ry="9" transform="rotate(-38 89 36)" fill="#0b0b0e"/>
    <circle cx="48" cy="62" r="7" fill="url(#r${e})" ${c}/>
    <path d="M99 18 C106 24 108 34 104 44 M104 9 C115 18 118 34 111 50" fill="none" stroke="url(#f${e})" stroke-width="2.6" stroke-linecap="round"/>`,framed:(e,t)=>`
    <rect x="14" y="8" width="92" height="104" rx="3" fill="#000" opacity=".5" transform="translate(0 3)"/>
    <rect x="14" y="8" width="92" height="104" rx="3" fill="url(#c${e})" ${c}/>
    <rect x="21" y="15" width="78" height="90" fill="#0d0d11"/>
    <path d="M44 24 L32 30 L24 46 L34 52 L38 48 V96 H82 V48 L86 52 L96 46 L88 30 L76 24 C72 31 66 34 60 34 C54 34 48 31 44 24 Z" fill="#1c1c23" stroke="url(#f${e})" stroke-width="1.5"/>
    <text x="60" y="${t.length>2?80:83}" text-anchor="middle" ${l} font-size="${t.length>2?24:32}" letter-spacing="-1" fill="url(#f${e})" ${c}>${t}</text>`,key:e=>`
    <g transform="rotate(-35 60 60)">
    <circle cx="60" cy="28" r="19" fill="url(#r${e})" ${c}/>
    <circle cx="60" cy="28" r="9" fill="#0b0b0e"/>
    ${[0,90,180,270].map(t=>`<circle cx="${60+15*Math.cos(t*Math.PI/180)}" cy="${28+15*Math.sin(t*Math.PI/180)}" r="5" fill="url(#f${e})" ${c}/>`).join(``)}
    <rect x="56" y="45" width="8" height="64" rx="2" fill="url(#c${e})" ${c}/>
    <rect x="52" y="50" width="16" height="5" rx="1.5" fill="url(#f${e})"/>
    <path d="M64 92 H76 V98 H70 V102 H76 V108 H64 Z" fill="url(#c${e})" ${c}/></g>`,triple:e=>`
    <path d="M14 92 L10 34 L36 58 L60 18 L84 58 L110 34 L106 92 Z" fill="#000" opacity=".45" transform="translate(0 3)"/>
    <path d="M14 92 L10 34 L36 58 L60 18 L84 58 L110 34 L106 92 Z" fill="url(#c${e})" ${c}/>
    <path d="M14 92 L10 34 L36 58 L60 18 L60 92 Z" fill="#fff" opacity=".12"/>
    <rect x="12" y="90" width="96" height="18" rx="3" fill="url(#f${e})" ${c}/>
    <circle cx="10" cy="32" r="6" fill="url(#r${e})"/><circle cx="60" cy="16" r="7" fill="url(#r${e})"/><circle cx="110" cy="32" r="6" fill="url(#r${e})"/>
    <circle cx="36" cy="99" r="4" fill="#c3243a"/><circle cx="60" cy="99" r="4.5" fill="#1f5fd1"/><circle cx="84" cy="99" r="4" fill="#1f9d55"/>`,hof:e=>`
    <ellipse cx="60" cy="112" rx="52" ry="3" fill="#000" opacity=".5"/>
    <path d="M10 44 L60 12 L110 44 Z" fill="url(#f${e})" ${c}/>
    <path d="M24 40 L60 18 L96 40 Z" fill="#000" opacity=".22"/>
    <rect x="12" y="44" width="96" height="7" fill="url(#c${e})" ${c}/>
    ${[22,42,62,82].map(t=>`<rect x="${t}" y="53" width="12" height="42" fill="url(#c${e})" ${c}/>`).join(``)}
    <rect x="8" y="95" width="104" height="7" fill="url(#c${e})" ${c}/>
    <rect x="4" y="102" width="112" height="8" fill="url(#d${e})" ${c}/>
    <polygon points="${f(d(60,33,6.5,2.7))}" fill="#fff" opacity=".9"/>`,legend:e=>{let t=``;for(let n=0;n<24;n++){let r=n*15*Math.PI/180,i=n%2?46:54;t+=`<path d="M${(60+30*Math.cos(r)).toFixed(1)} ${(60+30*Math.sin(r)).toFixed(1)} L${(60+i*Math.cos(r)).toFixed(1)} ${(60+i*Math.sin(r)).toFixed(1)}" stroke="url(#f${e})" stroke-width="${n%2?2:3.4}" stroke-linecap="round"/>`}return t+`<circle cx="60" cy="60" r="31" fill="url(#r${e})" ${c}/><circle cx="60" cy="60" r="25" fill="#0b0b0e"/>`+p(e,60,61,20,8.5)},ticket:e=>`
    <g transform="rotate(-12 60 60)">
    <path d="M10 36 H110 V52 A8 8 0 0 0 110 68 V84 H10 V68 A8 8 0 0 0 10 52 Z" fill="#000" opacity=".45" transform="translate(0 3)"/>
    <path d="M10 36 H110 V52 A8 8 0 0 0 110 68 V84 H10 V68 A8 8 0 0 0 10 52 Z" fill="url(#f${e})" ${c}/>
    <path d="M82 38 V82" stroke="#000" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="3 3"/>
    <rect x="18" y="44" width="58" height="32" rx="2" fill="none" stroke="#000" stroke-opacity=".35"/>
    <text x="47" y="66" text-anchor="middle" ${l} font-size="15" fill="#2a1a05" opacity=".8">SENIORS</text>
    <polygon points="${f(d(96,60,8,3.4))}" fill="#2a1a05" opacity=".7"/></g>`},v=e=>`<g>
  <path d="M79 79 H115 L111 90 L94 118 H80 L96 91 H76 Z" fill="#000" opacity=".55" transform="translate(1.5 2)"/>
  <path d="M79 79 H115 L111 90 L94 118 H80 L96 91 H76 Z" fill="url(#p${e})" stroke="#1b0640" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M79.6 80.2 H113.4 L112.2 84 H78.2 Z" fill="#fff" opacity=".55"/>
  <path d="M96 91 L111 90 L94 118 H87 Z" fill="#000" opacity=".22"/></g>`;function y(e,t){switch(e){case`flag7`:return[`flag`,``,!0];case`medal7`:return[`sevensmedal`,``,!0];case`calledup`:return[`ticket`,``,!0];case`clubgames`:return t===100?[`key`,``,!1]:[`framed`,String(t??``),!1];default:return[e,``,!1]}}function b(e,t,n,r){let i=n.replace(/[^a-zA-Z0-9]/g,``),[a,o,c]=y(e,r),l=_[a]||_.flag;return s(i,t)+l(i,o)+(c?v(i):``)}function x({kind:e,tier:t,step:n,label:a,size:o=56,title:s,className:c,locked:l}){let u=(0,r.useId)(),d=n??(a!=null&&a!==``?Number(a):null);return(0,i.jsx)(`svg`,{className:`emblem${l?` emblem-locked`:``}${c?` `+c:``}`,width:o,height:o,viewBox:`0 0 120 120`,role:`img`,"aria-label":s||e,dangerouslySetInnerHTML:{__html:(s?`<title>${s.replace(/[<&>]/g,``)}</title>`:``)+b(e,t,u,d)}})}function S({n:e}){return e<2||e>4?null:(0,i.jsx)(`span`,{className:`emblem-stars`,"aria-hidden":`true`,children:Array.from({length:e},(e,t)=>(0,i.jsx)(`svg`,{viewBox:`0 0 20 20`,children:(0,i.jsx)(`polygon`,{points:f(d(10,10.5,9.5,4)),fill:`#f0c35a`})},t))})}function C(e){return e.kind===`clubgames`?e.step===100?`Life Member`:`${e.step} club games`:e.times>1?`${e.name} x${e.times}`:e.name}function w(e){return[C(e),...e.items.map(e=>[e.year,e.detail].filter(Boolean).join(`, `))].join(`
`)}export{w as i,S as n,C as r,x as t};