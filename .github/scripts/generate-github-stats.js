const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USERNAME || 'harshpandeyz';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) throw new Error('GITHUB_TOKEN is required');

async function githubGraphQL(query, variables = {}) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json();
  if (!response.ok || data.errors?.length) throw new Error(JSON.stringify(data.errors || data));
  return data.data.user;
}

const QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      nodes {
        stargazerCount
        forkCount
        updatedAt
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const fmt = (v) => new Intl.NumberFormat('en-US').format(v);

const T = {
  bg0: '#111615', bg1: '#211C1A', white: '#F6EAD5', muted: '#BFAF9A', faint: '#806C5A',
  cyan: '#D6F06A', cobalt: '#B87445', violet: '#7C2D2D', lavender: '#E8B17B', teal: '#9BAE91', magenta: '#D8664B',
};

function getStreaks(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0, running = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].contributionCount === 0) { running = 0; continue; }
    if (i > 0 && sorted[i - 1].contributionCount > 0) {
      const prev = new Date(`${sorted[i - 1].date}T00:00:00Z`);
      const cur = new Date(`${sorted[i].date}T00:00:00Z`);
      running = ((cur - prev) / 86400000 === 1) ? running + 1 : 1;
    } else running = 1;
    longest = Math.max(longest, running);
  }
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].contributionCount === 0) break;
    if (i < sorted.length - 1) {
      const next = new Date(`${sorted[i + 1].date}T00:00:00Z`);
      const day = new Date(`${sorted[i].date}T00:00:00Z`);
      if ((next - day) / 86400000 !== 1) break;
    }
    current += 1;
  }
  return { current, longest };
}

function getLanguages(repos) {
  const m = new Map();
  for (const r of repos) for (const e of r.languages?.edges || []) {
    const n = e.node?.name; if (!n) continue;
    const ex = m.get(n) || { name: n, size: 0, color: e.node.color || T.violet };
    ex.size += e.size; m.set(n, ex);
  }
  return [...m.values()].sort((a, b) => b.size - a.size);
}

function niceColor(name, fallback) {
  const garish = { 'JavaScript': '#E8C84A', 'HTML': '#E0704A', 'CSS': '#6B8FD4' };
  return garish[name] || fallback;
}

function defs(p) {
  return `<defs>
<linearGradient id="${p}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${T.bg1}"/><stop offset="100%" stop-color="${T.bg0}"/></linearGradient>
<linearGradient id="${p}-bd" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${T.cyan}" stop-opacity="0.6"/><stop offset="40%" stop-color="${T.cobalt}" stop-opacity="0.35"/><stop offset="75%" stop-color="${T.violet}" stop-opacity="0.35"/><stop offset="100%" stop-color="${T.teal}" stop-opacity="0.45"/></linearGradient>
<linearGradient id="${p}-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F6EAD5" stop-opacity="0.08"/><stop offset="100%" stop-color="#F6EAD5" stop-opacity="0.015"/></linearGradient>
<radialGradient id="${p}-gC" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${T.cyan}" stop-opacity="0.14"/><stop offset="100%" stop-color="${T.cyan}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-gV" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${T.violet}" stop-opacity="0.18"/><stop offset="100%" stop-color="${T.violet}" stop-opacity="0"/></radialGradient>
<pattern id="${p}-gr" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#D8C09E" stroke-opacity="0.08"/><circle cx="0" cy="0" r="1.2" fill="#D6F06A" fill-opacity="0.18"/></pattern>
</defs>
<style><![CDATA[
.bar{animation:bU 1.6s ease-out both;transform-box:fill-box}
@keyframes bU{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.draw{stroke-dasharray:1400;stroke-dashoffset:1400;animation:dL 2.6s ease-out forwards}
@keyframes dL{to{stroke-dashoffset:0}}
.fade{animation:fI 1s ease-out both}
@keyframes fI{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pulse{animation:pL 2.2s ease-in-out infinite}
@keyframes pL{0%,100%{opacity:1}50%{opacity:.35}}
.donut{animation:dR 2s ease-out both;transform-origin:center;transform-box:fill-box}
@keyframes dR{from{transform:rotate(-90deg) scale(.94);opacity:0}to{transform:rotate(0) scale(1);opacity:1}}
@media(prefers-reduced-motion:reduce){.bar,.draw,.fade,.pulse,.donut{animation:none}}
]]></style>`;
}

function monthBuckets(days) {
  const buckets = new Array(12).fill(0); const labels = [];
  const now = new Date(days[days.length - 1].date + 'T00:00:00Z');
  for (let i = 11; i >= 0; i--) labels.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toLocaleString('en-US', { month: 'short' }));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  for (const d of days) {
    const dt = new Date(d.date + 'T00:00:00Z'); if (dt < start) continue;
    const idx = (dt.getUTCFullYear() - start.getUTCFullYear()) * 12 + (dt.getUTCMonth() - start.getUTCMonth());
    if (idx >= 0 && idx < 12) buckets[idx] += d.contributionCount;
  }
  return { buckets, labels };
}

function quarterRepoActivity(repos) {
  // repos updated per quarter, last 8 quarters (real updatedAt, newest 100)
  const now = new Date();
  const labels = []; const buckets = new Array(8).fill(0);
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i * 3, 1));
    labels.push(`Q${Math.floor(d.getUTCMonth() / 3) + 1} '${String(d.getUTCFullYear()).slice(2)}`);
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1));
  for (const r of repos) {
    const dt = new Date(r.updatedAt); if (dt < start || Number.isNaN(dt)) continue;
    const idx = Math.min(7, Math.floor(((dt.getUTCFullYear() - start.getUTCFullYear()) * 12 + (dt.getUTCMonth() - start.getUTCMonth())) / 3));
    if (idx >= 0) buckets[idx] += 1;
  }
  return { buckets, labels };
}

function frameOpen(w, h, p, title, right) {
  return `<rect width="${w}" height="${h}" rx="26" fill="url(#${p}-bg)" stroke="url(#${p}-bd)" stroke-width="1.5"/>
<rect width="${w}" height="${h}" rx="26" fill="url(#${p}-gl)"/>
<rect width="${w}" height="${h}" rx="26" fill="url(#${p}-gr)" opacity="0.55"/>
<ellipse cx="300" cy="30" rx="380" ry="120" fill="url(#${p}-gC)"/><ellipse cx="${w - 300}" cy="30" rx="420" ry="120" fill="url(#${p}-gV)"/>
<text x="48" y="62" fill="${T.white}" font-family="Inter,Arial" font-size="30" font-weight="800">${title}</text>
<text x="${w - 48}" y="62" text-anchor="end" fill="${T.muted}" font-family="Inter,Arial" font-size="17">@${esc(USERNAME)} • live from GitHub API</text>
<line x1="48" y1="84" x2="${w - 48}" y2="84" stroke="#D8C09E" stroke-opacity="0.2"/>${right || ''}`;
}

// 1 — KPI strip: 6 glass KPIs + monthly micro-bars
function buildKpi(user, stamp) {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const { current, longest } = getStreaks(days);
  const stars = user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const { buckets, labels } = monthBuckets(days);
  const maxB = Math.max(...buckets, 1);
  const W = 1600, H = 470, p = 'kpi';
  const kpis = [
    ['CONTRIBUTIONS • 1Y', fmt(c.contributionCalendar.totalContributions), T.cyan, `${fmt(c.totalCommitContributions)} commits`],
    ['STARS EARNED', fmt(stars), T.magenta, `${user.repositories.totalCount} public repos`],
    ['PUBLIC REPOS', fmt(user.repositories.totalCount), T.teal, `${fmt(user.repositories.nodes.reduce((s, r) => s + r.forkCount, 0))} forks`],
    ['FOLLOWERS', fmt(user.followers.totalCount), T.cyan, 'building in public'],
    ['CURRENT STREAK', `${current}d`, current > 0 ? T.teal : T.magenta, `best ${longest}d`],
    ['PULL REQUESTS', fmt(c.totalPullRequestContributions), T.lavender, `${fmt(c.totalIssueContributions)} issues • ${fmt(c.totalPullRequestReviewContributions)} reviews`],
  ];
  let cells = '';
  kpis.forEach(([label, value, col, sub], i) => {
    const x = 48 + i * 252;
    cells += `<g class="fade" style="animation-delay:${i * 90}ms"><rect x="${x}" y="112" width="228" height="150" rx="18" fill="#F6EAD5" fill-opacity="0.045" stroke="#D8C09E" stroke-opacity="0.18"/><rect x="${x}" y="112" width="228" height="4" rx="2" fill="${col}" opacity="0.8"/><text x="${x + 20}" y="146" fill="${T.muted}" font-family="Inter,Arial" font-size="13" letter-spacing="1.2">${label}</text><text x="${x + 20}" y="196" fill="${col}" font-family="Inter,Arial" font-size="46" font-weight="800">${value}</text><text x="${x + 20}" y="230" fill="${T.muted}" font-family="Inter,Arial" font-size="14">${esc(sub)}</text></g>`;
  });
  let bars = '';
  buckets.forEach((v, i) => {
    const h = Math.max(6, Math.round((v / maxB) * 110));
    const x = 48 + i * 126; const y = 428 - h;
    const col = i === 11 ? T.cyan : i > 8 ? T.cobalt : T.violet;
    bars += `<g class="bar" style="animation-delay:${i * 70}ms;transform-origin:${x}px 428px"><rect x="${x}" y="${y}" width="92" height="${h}" rx="10" fill="${col}" opacity="${(0.45 + (v / maxB) * 0.55).toFixed(2)}"><title>${labels[i]}: ${fmt(v)} contributions</title></rect></g><text x="${x + 46}" y="452" text-anchor="middle" fill="${T.faint}" font-family="Inter,Arial" font-size="14">${labels[i]}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(p)}${frameOpen(W, H, p, '◉  GitHub intelligence — KPI overview', `<circle cx="${W - 352}" cy="57" r="6" fill="${T.teal}" class="pulse"/>`)}${cells}<text x="48" y="300" fill="${T.muted}" font-family="Inter,Arial" font-size="14" letter-spacing="1.5">MONTHLY CONTRIBUTIONS • LAST 12 MONTHS</text>${bars}<text x="${W - 48}" y="300" text-anchor="end" fill="${T.faint}" font-family="Inter,Arial" font-size="13">updated ${stamp} UTC • contributionsCollection + repositories</text></svg>`;
}

// 2 — heatmap + consistency
function buildHeatmap(user, stamp) {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const { current, longest } = getStreaks(days);
  const W = 1600, H = 560, p = 'heat';
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const first = new Date(`${days[0].date}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  let cells = '';
  for (let week = 0; week < 53; week += 1) {
    cells += `<g class="fade" style="animation-delay:${Math.min(week * 18, 900)}ms">`;
    for (let wd = 0; wd < 7; wd += 1) {
      const dt = new Date(first); dt.setUTCDate(first.getUTCDate() + week * 7 + wd);
      const key = dt.toISOString().slice(0, 10);
      const day = dayMap.get(key); if (!day) continue;
      const n = day.contributionCount;
      const col = n === 0 ? '#29322C' : n < 3 ? '#3D5A43' : n < 5 ? '#56764C' : n < 8 ? '#7F995D' : n < 12 ? '#A9B96A' : T.cyan;
      const op = n === 0 ? 1 : (0.55 + Math.min(0.45, n / 20)).toFixed(2);
      const x = (60 + week * 21.4).toFixed(1); const y = 130 + wd * 21.4;
      cells += `<rect x="${x}" y="${y}" width="17" height="17" rx="4.5" fill="${col}" opacity="${op}"><title>${key}: ${n} contributions</title>${n >= 10 ? `<animate attributeName="opacity" values="${op};0.35;${op}" dur="2.8s" repeatCount="indefinite"/>` : ''}</rect>`;
    }
    cells += '</g>';
  }
  const activeWeeks = c.contributionCalendar.weeks.filter((w) => w.contributionDays.some((d) => d.contributionCount > 0)).length;
  const consistency = Math.round((activeWeeks / c.contributionCalendar.weeks.length) * 100);
  const best = Math.max(...days.map((d) => d.contributionCount));
  const panel = `
<line x1="48" y1="352" x2="${W - 48}" y2="352" stroke="#D8C09E" stroke-opacity="0.16"/>
<text x="60" y="384" fill="${T.muted}" font-family="Inter,Arial" font-size="14" letter-spacing="1.5">CODING CONSISTENCY • PROJECT OVERVIEW</text>
${[['ACTIVE WEEKS', `${activeWeeks}/${c.contributionCalendar.weeks.length} • ${consistency}%`, T.cyan, 60], ['CURRENT STREAK', `${current}d`, current > 0 ? T.teal : T.magenta, 400], ['LONGEST STREAK', `${longest}d`, T.teal, 700], ['BEST DAY', `${fmt(best)}`, T.white, 1000], ['TOTAL COMMITS', fmt(c.totalCommitContributions), T.white, 1280]].map(([l, v, col, x]) => `<text x="${x}" y="414" fill="${T.muted}" font-family="Inter,Arial" font-size="13" letter-spacing="1">${l}</text><text x="${x}" y="462" fill="${col}" font-family="Inter,Arial" font-size="44" font-weight="800">${v}</text>`).join('')}
<rect x="60" y="486" width="420" height="10" rx="5" fill="#F6EAD5" opacity="0.08"/><rect x="60" y="486" width="${Math.round(420 * consistency / 100)}" height="10" rx="5" fill="${T.teal}" opacity="0.9" class="bar"/>
<text x="${W - 60}" y="500" text-anchor="end" fill="${T.faint}" font-family="Inter,Arial" font-size="13">consistency = weeks with ≥1 contribution • ${stamp} UTC</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(p)}${frameOpen(W, H, p, '▦  Contribution heatmap — last 12 months', '')}
<text x="${W - 48}" y="62" text-anchor="end" fill="${T.muted}" font-family="Inter,Arial" font-size="17" dx="-340">${fmt(c.contributionCalendar.totalContributions)} contributions</text>
${cells}
<text x="60" y="300" fill="#F6EAD5" opacity="0.5" font-family="monospace" font-size="13">Jan     Feb    Mar    Apr    May   Jun     Jul     Aug    Sep     Oct    Nov    Dec</text>
<text x="1210" y="300" fill="${T.muted}" font-family="Inter,Arial" font-size="14">Less</text>
${['#29322C', '#3D5A43', '#56764C', '#7F995D', T.cyan].map((col, i) => `<rect x="${1262 + i * 26}" y="288" width="18" height="18" rx="5" fill="${col}"/>`).join('')}<text x="1400" y="302" fill="${T.muted}" font-family="Inter,Arial" font-size="14">More</text>
${panel}</svg>`;
}

// 3 — trends: monthly area + weekly rhythm + repo growth
function buildTrends(user, stamp) {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const { buckets, labels } = monthBuckets(days);
  const maxB = Math.max(...buckets, 1);
  const weeks = c.contributionCalendar.weeks.slice(-26);
  const wT = weeks.map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
  const maxW = Math.max(...wT, 1);
  const q = quarterRepoActivity(user.repositories.nodes);
  const maxQ = Math.max(...q.buckets, 1);
  const W = 1600, H = 600, p = 'trd';
  const mPts = buckets.map((v, i) => `${(80 + (i / 11) * 680).toFixed(1)},${(430 - (v / maxB) * 240).toFixed(1)}`).join(' ');
  const wPts = wT.map((v, i) => `${(880 + (i / (wT.length - 1)) * 640).toFixed(1)},${(300 - (v / maxW) * 170).toFixed(1)}`).join(' ');
  let mBars = '';
  buckets.forEach((v, i) => {
    const h = Math.max(8, Math.round((v / maxB) * 240)); const x = 80 + (i / 11) * 680 - 22;
    mBars += `<g class="bar" style="animation-delay:${i * 60}ms;transform-origin:${x + 22}px 430px"><rect x="${x.toFixed(1)}" y="${430 - h}" width="44" height="${h}" rx="8" fill="${i === 11 ? T.cyan : T.cobalt}" opacity="${(0.4 + (v / maxB) * 0.6).toFixed(2)}"><title>${labels[i]}: ${fmt(v)} contributions</title></rect></g>`;
  });
  let qBars = '';
  q.buckets.forEach((v, i) => {
    const h = Math.max(5, Math.round((v / maxQ) * 90)); const x = 880 + i * 80;
    qBars += `<rect x="${x}" y="${540 - h}" width="52" height="${h}" rx="7" fill="${T.violet}" opacity="${(0.4 + (v / maxQ) * 0.6).toFixed(2)}"><title>${q.labels[i]}: ${v} repos updated</title></rect><text x="${x + 26}" y="560" text-anchor="middle" fill="${T.faint}" font-family="Inter,Arial" font-size="12">${q.labels[i]}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(p)}${frameOpen(W, H, p, '〜  Activity trends — monthly, weekly, repository growth', '')}
<text x="80" y="124" fill="${T.muted}" font-family="Inter,Arial" font-size="14" letter-spacing="1.5">YEARLY / MONTHLY CONTRIBUTIONS</text>
<polygon points="80,430 ${mPts} 760,430" fill="${T.cobalt}" opacity="0.14"/>
<polyline points="${mPts}" fill="none" stroke="url(#${p}-bd)" stroke-width="3.5" stroke-linecap="round" class="draw"/>${mBars}
<text x="80" y="470" fill="${T.white}" font-family="Inter,Arial" font-size="16">Peak ${fmt(maxB)}/mo • Total ${fmt(c.contributionCalendar.totalContributions)}/yr</text>
<line x1="820" y1="110" x2="820" y2="570" stroke="#D8C09E" stroke-opacity="0.16"/>
<text x="880" y="124" fill="${T.muted}" font-family="Inter,Arial" font-size="14" letter-spacing="1.5">26-WEEK RHYTHM • CONTRIBUTIONS / WEEK</text>
<polygon points="880,300 ${wPts} 1520,300" fill="${T.teal}" opacity="0.10"/>
<polyline points="${wPts}" fill="none" stroke="${T.teal}" stroke-width="3" stroke-linecap="round" class="draw"/>
${wT.map((v, i) => `<circle cx="${(880 + (i / (wT.length - 1)) * 640).toFixed(1)}" cy="${(300 - (v / maxW) * 170).toFixed(1)}" r="${i === wT.length - 1 ? 7 : 3.5}" fill="${i === wT.length - 1 ? T.cyan : T.cobalt}"><title>Week ${i + 1}: ${v}</title>${i === wT.length - 1 ? '<animate attributeName="r" values="7;9.5;7" dur="1.8s" repeatCount="indefinite"/>' : ''}</circle>`).join('')}
<text x="880" y="336" fill="${T.white}" font-family="Inter,Arial" font-size="16">Peak ${fmt(maxW)}/wk • Avg ${(wT.reduce((a, b) => a + b, 0) / wT.length).toFixed(1)}/wk</text>
<text x="880" y="380" fill="${T.muted}" font-family="Inter,Arial" font-size="14" letter-spacing="1.5">REPOSITORY GROWTH • REPOS UPDATED / QUARTER</text>${qBars}
<text x="1520" y="500" text-anchor="end" fill="${T.faint}" font-family="Inter,Arial" font-size="12">newest 100 repos • ${stamp} UTC</text></svg>`;
}

// 4 — languages donut + most-used tech
function buildLanguages(user, stamp) {
  const langs = getLanguages(user.repositories.nodes).slice(0, 8);
  const total = langs.reduce((s, l) => s + l.size, 0) || 1;
  const stars = user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const W = 1600, H = 560, p = 'lng';
  const R = 150, CX = 300, CY = 320, CIRC = 2 * Math.PI * R;
  const pal = [T.cyan, T.cobalt, T.violet, T.teal, T.lavender, T.magenta, '#7F995D', '#BFAF9A'];
  let off = 0, segs = '';
  langs.slice(0, 6).forEach((l, i) => {
    const frac = l.size / total, len = frac * CIRC;
    const col = niceColor(l.name, l.color || pal[i % pal.length]);
    segs += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${col}" stroke-width="46" stroke-dasharray="${len.toFixed(1)} ${(CIRC - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" stroke-linecap="round" opacity="0.92" class="donut" style="animation-delay:${i * 160}ms"><title>${esc(l.name)} ${Math.round(frac * 100)}%</title></circle>`;
    off += len;
  });
  let rows = '';
  langs.forEach((l, i) => {
    const pct = Math.round((l.size / total) * 100);
    const y = 150 + i * 48; const w = Math.max(14, Math.round((l.size / langs[0].size) * 560));
    const col = niceColor(l.name, l.color || pal[i % pal.length]);
    rows += `<g class="fade" style="animation-delay:${i * 90}ms"><circle cx="620" cy="${y - 6}" r="9" fill="${col}"/><text x="640" y="${y}" fill="${T.white}" font-family="Inter,Arial" font-size="20">${esc(l.name)}</text><text x="900" y="${y}" fill="${T.muted}" font-family="Inter,Arial" font-size="18">${pct}%</text><rect x="960" y="${y - 18}" width="560" height="14" rx="7" fill="#F6EAD5" opacity="0.07"/><rect x="960" y="${y - 18}" width="${w}" height="14" rx="7" fill="${col}" opacity="0.9" class="bar" style="transform-origin:960px ${y}px"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(p)}${frameOpen(W, H, p, '◍  Language distribution — most-used technologies', '')}
<text x="${W - 48}" y="62" text-anchor="end" fill="${T.muted}" font-family="Inter,Arial" font-size="17" dx="-420">${fmt(stars)} stars • ${fmt(user.repositories.totalCount)} repos</text>
${segs}
<circle cx="${CX}" cy="${CY}" r="98" fill="#171614" stroke="#D8C09E" stroke-opacity="0.2"/>
<text x="${CX}" y="${CY - 6}" text-anchor="middle" fill="${T.white}" font-family="Inter,Arial" font-size="52" font-weight="800">${langs.length}</text>
<text x="${CX}" y="${CY + 28}" text-anchor="middle" fill="${T.muted}" font-family="Inter,Arial" font-size="15" letter-spacing="2">LANGUAGES</text>
${rows}
<text x="620" y="522" fill="${T.faint}" font-family="Inter,Arial" font-size="13">byte-size across newest 100 public repos • leftover grouped beyond top 8 • ${stamp} UTC</text></svg>`;
}

// 5 — compact activity snapshot for profile/ (live, animated, reduced-motion safe)
function buildActivity(user, stamp) {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const { current, longest } = getStreaks(days);
  const total = c.contributionCalendar.totalContributions;
  // longest-streak window label (approx)
  let bestStart = '', bestEnd = '';
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let runStart = null, bestLen = 0, curLen = 0;
  sorted.forEach((d) => {
    if (d.contributionCount > 0) {
      if (curLen === 0) runStart = d.date;
      curLen += 1;
      if (curLen > bestLen) { bestLen = curLen; bestEnd = d.date; bestStart = runStart; }
    } else curLen = 0;
  });
  const range = bestStart ? `${new Date(`${bestStart}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(`${bestEnd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : stamp;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="290" viewBox="0 0 1100 290" role="img" aria-labelledby="ga-title ga-desc">`
+ `<title id="ga-title">GitHub activity — ${fmt(total)} contributions in the last year</title><desc id="ga-desc">A warm activity snapshot showing yearly contributions, current streak ${current} days, and longest streak ${longest} days.</desc>`
+ `<defs><linearGradient id="ga-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#211C1A"/><stop offset="1" stop-color="#111615"/></linearGradient><linearGradient id="ga-rule" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#D6F06A"/><stop offset=".5" stop-color="#E8B17B"/><stop offset="1" stop-color="#9BAE91"/></linearGradient><pattern id="ga-grain" width="70" height="70" patternUnits="userSpaceOnUse"><circle cx="17" cy="12" r=".6" fill="#F6EAD5" opacity=".16"/><circle cx="55" cy="52" r=".5" fill="#D6F06A" opacity=".12"/></pattern></defs>`
+ `<style><![CDATA[.ga-orbit{animation:gaOrbit 18s linear infinite;transform-origin:550px 145px}@keyframes gaOrbit{to{transform:rotate(360deg)}}.ga-pulse{animation:gaPulse 2.4s ease-in-out infinite}@keyframes gaPulse{0%,100%{opacity:.6}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.ga-orbit,.ga-pulse{animation:none}}]]></style>`
+ `<rect x="1" y="1" width="1098" height="288" rx="22" fill="url(#ga-bg)" stroke="#D8C09E" stroke-opacity=".35" stroke-width="2"/><rect width="1100" height="290" rx="22" fill="url(#ga-grain)" opacity=".5"/><text x="42" y="46" fill="#F6EAD5" font-family="Georgia,serif" font-size="27">GitHub activity</text><text x="1058" y="45" text-anchor="end" fill="#D6F06A" font-family="Arial,sans-serif" font-size="11" letter-spacing="1.7">A YEAR IN MOTION · ${esc(stamp)} UTC</text><path d="M42 70H1058" stroke="#D8C09E" stroke-opacity=".25"/><path d="M366 92V250M734 92V250" stroke="#D8C09E" stroke-opacity=".22"/>`
+ `<g font-family="Arial,sans-serif"><text x="183" y="132" text-anchor="middle" fill="#D6F06A" font-size="42" font-weight="700">${fmt(total)}</text><text x="183" y="166" text-anchor="middle" fill="#BFAF9A" font-size="15" letter-spacing="1.1">CONTRIBUTIONS · 1Y</text><text x="183" y="199" text-anchor="middle" fill="#806C5A" font-size="13">${fmt(c.totalCommitContributions)} commits</text><circle cx="550" cy="145" r="54" fill="none" stroke="#D8664B" stroke-width="8" stroke-dasharray="4 12" class="ga-orbit"/><circle cx="550" cy="145" r="42" fill="none" stroke="#D8C09E" stroke-opacity=".25" stroke-width="2" class="ga-pulse"/><text x="550" y="157" text-anchor="middle" fill="#E8B17B" font-size="38" font-weight="700">${current}</text><text x="550" y="205" text-anchor="middle" fill="#BFAF9A" font-size="15" letter-spacing="1.1">CURRENT STREAK</text><text x="550" y="232" text-anchor="middle" fill="#806C5A" font-size="13">best ${longest} days</text><text x="917" y="132" text-anchor="middle" fill="#9BAE91" font-size="42" font-weight="700">${longest}</text><text x="917" y="166" text-anchor="middle" fill="#BFAF9A" font-size="15" letter-spacing="1.1">LONGEST STREAK</text><text x="917" y="199" text-anchor="middle" fill="#806C5A" font-size="13">${esc(range)}</text></g></svg>`;
}

async function main() {
  const user = await githubGraphQL(QUERY, { login: USERNAME });
  if (!user) throw new Error(`GitHub user ${USERNAME} not found`);
  const out = path.join(process.cwd(), 'assets', 'analytics');
  fs.mkdirSync(out, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(out, 'kpi-strip.svg'), buildKpi(user, stamp));
  fs.writeFileSync(path.join(out, 'heatmap.svg'), buildHeatmap(user, stamp));
  fs.writeFileSync(path.join(out, 'trends.svg'), buildTrends(user, stamp));
  fs.writeFileSync(path.join(out, 'languages.svg'), buildLanguages(user, stamp));
  const profileOut = path.join(process.cwd(), 'profile');
  fs.mkdirSync(profileOut, { recursive: true });
  fs.writeFileSync(path.join(profileOut, 'github-activity.svg'), buildActivity(user, stamp));
  console.log('Generated assets/analytics/kpi-strip.svg');
  console.log('Generated assets/analytics/heatmap.svg');
  console.log('Generated assets/analytics/trends.svg');
  console.log('Generated assets/analytics/languages.svg');
  console.log('Generated profile/github-activity.svg');
}

main().catch((e) => { console.error(e); process.exit(1); });
