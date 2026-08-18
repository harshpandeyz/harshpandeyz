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
  if (!response.ok || data.errors?.length) {
    throw new Error(JSON.stringify(data.errors || data));
  }
  return data.data.user;
}

const QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node { name color }
          }
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
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const fmt = (value) => new Intl.NumberFormat('en-US').format(value);

function getStreaks(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let running = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].contributionCount === 0) {
      running = 0;
      continue;
    }

    if (i > 0 && sorted[i - 1].contributionCount > 0) {
      const previous = new Date(`${sorted[i - 1].date}T00:00:00Z`);
      const current = new Date(`${sorted[i].date}T00:00:00Z`);
      const daysApart = (current - previous) / 86400000;
      running = daysApart === 1 ? running + 1 : 1;
    } else {
      running = 1;
    }

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

function getLanguages(repositories) {
  const totals = new Map();

  for (const repo of repositories) {
    for (const edge of repo.languages?.edges || []) {
      const name = edge.node?.name;
      if (!name) continue;

      const existing = totals.get(name) || {
        name,
        size: 0,
        color: edge.node.color || '#7C3AED',
      };

      existing.size += edge.size;
      totals.set(name, existing);
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
}

function buildStatsCard(user) {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
  const { current, longest } = getStreaks(days);
  const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);

  const bg = '#0D1117';
  const border = '#30363D';
  const white = '#F0F6FC';
  const muted = '#8B949E';
  const cyan = '#00E5FF';
  const pink = '#FF1493';
  const green = '#00F5D4';

  const metrics = [
    [130, c.contributionCalendar.totalContributions, 'CONTRIBUTIONS', cyan],
    [300, stars, 'STARS', pink],
    [470, user.repositories.totalCount, 'PUBLIC REPOS', green],
    [640, user.followers.totalCount, 'FOLLOWERS', cyan],
  ];

  const metricSvg = metrics.map(([x, value, label, color]) => `
    <text x="${x}" y="82" text-anchor="middle" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">${fmt(value)}</text>
    <text x="${x}" y="105" text-anchor="middle" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="600">${label}</text>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="210" viewBox="0 0 800 210">
  <rect width="800" height="210" rx="18" fill="${bg}" stroke="${border}"/>
  <text x="30" y="36" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700">${esc(user.name || user.login)} · GitHub</text>
  <text x="770" y="36" text-anchor="end" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="12">@${esc(user.login)}</text>
  <line x1="30" y1="50" x2="770" y2="50" stroke="${border}"/>
  ${metricSvg}
  <line x1="215" y1="62" x2="215" y2="118" stroke="${border}"/>
  <line x1="385" y1="62" x2="385" y2="118" stroke="${border}"/>
  <line x1="555" y1="62" x2="555" y2="118" stroke="${border}"/>
  <text x="30" y="150" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="11">ACTIVITY</text>
  <text x="30" y="178" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="13">${fmt(c.totalCommitContributions)} commits</text>
  <text x="205" y="178" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="13">${fmt(c.totalPullRequestContributions)} PRs</text>
  <text x="345" y="178" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="13">${fmt(c.totalIssueContributions)} issues</text>
  <text x="475" y="178" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="13">${fmt(c.totalPullRequestReviewContributions)} reviews</text>
  <text x="645" y="178" fill="${pink}" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700">${current}d streak</text>
  <text x="770" y="178" text-anchor="end" fill="${green}" font-family="Arial,Helvetica,sans-serif" font-size="13">${longest}d best</text>
</svg>`;
}

function buildContributionCard(user) {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
  const { current, longest } = getStreaks(days);
  const languages = getLanguages(user.repositories.nodes);
  const languageTotal = languages.reduce((sum, language) => sum + language.size, 0) || 1;

  const bg = '#0D1117';
  const border = '#30363D';
  const white = '#F0F6FC';
  const muted = '#8B949E';
  const purple = '#7C3AED';
  const pink = '#FF1493';
  const green = '#00F5D4';

  const dayMap = new Map(days.map((day) => [day.date, day]));
  const first = new Date(`${days[0].date}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());

  let cells = '';
  for (let week = 0; week < 53; week += 1) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(first);
      date.setUTCDate(first.getUTCDate() + week * 7 + weekday);
      const key = date.toISOString().slice(0, 10);
      const day = dayMap.get(key);
      if (!day) continue;

      const count = day.contributionCount;
      const color = count === 0
        ? '#161B22'
        : count < 5
          ? purple
          : count < 10
            ? '#A855F7'
            : count < 20
              ? '#D946EF'
              : pink;

      const x = 35 + week * 14;
      const y = 74 + weekday * 14;
      cells += `<rect x="${x}" y="${y}" width="11" height="11" rx="2" fill="${color}"><title>${key}: ${count} contribution${count === 1 ? '' : 's'}</title></rect>`;
    }
  }

  let languageRows = '';
  languages.forEach((language, index) => {
    const percent = Math.round((language.size / languageTotal) * 100);
    const y = 204 + index * 24;
    languageRows += `<circle cx="40" cy="${y - 4}" r="5" fill="${language.color || purple}"/><text x="54" y="${y}" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="12">${esc(language.name)}</text><text x="300" y="${y}" text-anchor="end" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="12">${percent}%</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="350" viewBox="0 0 800 350">
  <rect width="800" height="350" rx="18" fill="${bg}" stroke="${border}"/>
  <text x="30" y="36" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700">Contribution garden</text>
  <text x="770" y="36" text-anchor="end" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="12">${fmt(c.contributionCalendar.totalContributions)} in the last year</text>
  <line x1="30" y1="50" x2="770" y2="50" stroke="${border}"/>
  ${cells}
  <text x="35" y="185" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="11">TOP LANGUAGES</text>
  ${languageRows}
  <line x1="365" y1="188" x2="365" y2="320" stroke="${border}"/>
  <text x="405" y="210" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="11">CURRENT STREAK</text>
  <text x="405" y="245" fill="${pink}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">${current}d</text>
  <text x="530" y="210" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="11">LONGEST STREAK</text>
  <text x="530" y="245" fill="${green}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">${longest}d</text>
  <text x="405" y="285" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="11">COMMITS</text>
  <text x="405" y="315" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700">${fmt(c.totalCommitContributions)}</text>
  <text x="530" y="285" fill="${muted}" font-family="Arial,Helvetica,sans-serif" font-size="11">PRs / ISSUES</text>
  <text x="530" y="315" fill="${white}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700">${fmt(c.totalPullRequestContributions)} / ${fmt(c.totalIssueContributions)}</text>
</svg>`;
}

async function main() {
  const user = await githubGraphQL(QUERY, { login: USERNAME });
  if (!user) throw new Error(`GitHub user ${USERNAME} not found`);

  const assetsDir = path.join(process.cwd(), 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'github-stats.svg'), buildStatsCard(user));
  fs.writeFileSync(path.join(assetsDir, 'github-contributions.svg'), buildContributionCard(user));

  console.log('Generated assets/github-stats.svg');
  console.log('Generated assets/github-contributions.svg');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
