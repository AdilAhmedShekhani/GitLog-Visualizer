#!/usr/bin/env node
/**
 * Git Log Visualizer (simplified CLI)
 * New design: Only output requested sections; supports plain text or JSON (--format json)
 * Keeps backward compatibility for --repo --days --all --author but no longer prints
 * decorative ASCII or colors. No external deps.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

// ---------------- Utility ----------------
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYmdUTC(s) {
  if (!s) return NaN;
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function diffDaysInclusive(start, end) {
  const msPerDay = 86400000;
  return (parseYmdUTC(end) - parseYmdUTC(start)) / msPerDay + 1;
}
function parseArgs(argv) {
  const args = {
    repo: ".",
    days: null, // legacy
    all: false,
    author: null,
    since: null,
    until: null,
    format: "text",
    // contributor related
    contributors: false,
    topContributors: null, // number
    contributorStats: false,
    // frequency
    commitFrequency: null, // daily|weekly|monthly
    commitFrequencyByAuthor: false,
    commitFrequencyByBranch: false,
    // branches
    branches: false,
    branchStats: false,
    // commit stats
    totalCommits: false,
    averageCommitsPerDay: false,
    commitDistribution: false,
    // file/dir stats
    fileStats: false,
    directoryStats: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const next = () => argv[++i];
    if (t === "--repo") args.repo = next();
    else if (t === "--all") args.all = true;
    else if (t === "--author") args.author = next();
    else if (t === "--days") args.days = parseInt(next(), 10) || null;
    else if (t.startsWith("--since"))
      args.since = t.includes("=") ? t.split("=")[1] : next();
    else if (t.startsWith("--until"))
      args.until = t.includes("=") ? t.split("=")[1] : next();
    else if (t === "--contributors") args.contributors = true;
    else if (t === "--top-contributors")
      args.topContributors = parseInt(next(), 10) || 10;
    else if (t === "--contributor-stats") args.contributorStats = true;
    else if (t.startsWith("--commit-frequency")) {
      if (t.includes("=")) args.commitFrequency = t.split("=")[1] || "daily";
      else args.commitFrequency = "daily";
    } else if (t === "--commit-frequency-by-author")
      args.commitFrequencyByAuthor = true;
    else if (t === "--commit-frequency-by-branch")
      args.commitFrequencyByBranch = true;
    else if (t === "--branches") args.branches = true;
    else if (t === "--branch-stats") args.branchStats = true;
    else if (t === "--total-commits") args.totalCommits = true;
    else if (t === "--average-commits-per-day")
      args.averageCommitsPerDay = true;
    else if (t === "--commit-distribution") args.commitDistribution = true;
    else if (t === "--file-stats") args.fileStats = true;
    else if (t === "--directory-stats") args.directoryStats = true;
    else if (t === "--format") args.format = (next() || "text").toLowerCase();
    else if (t === "-h" || t === "--help") args.help = true;
    // Backward compatibility (ignored aesthetics): --width --top --limit-branches --no-* are ignored now
    else if (t === "--top") {
      args.topContributors = parseInt(next(), 10) || 10;
      args.contributors = true;
    } else if (t === "--limit-branches") {
      next(); /* ignore */
    } else if (
      t === "--no-branches" ||
      t === "--no-contrib" ||
      t === "--no-graph"
    ) {
      /* ignore */
    }
  }
  return args;
}
function printHelp() {
  const help = `Git Log Visualizer CLI (plain output)\nUsage: node gitviz.js [options]\nTime Filters:\n  --since <YYYY-MM-DD>       Start date inclusive\n  --until <YYYY-MM-DD>       End date inclusive\n  --days <n>                 (Legacy) last n days (ignored if --since provided)\nScope Filters:\n  --repo <path>              Repository path (default .)\n  --all                      Include all refs\n  --author <pattern>         Filter by author (git regex)\nOutput Format:\n  --format json|text         Default text\nContributors:\n  --contributors             List contributors (name,email,commits)\n  --top-contributors <n>     Top N contributors (implies --contributors)\n  --contributor-stats        Commits, lines added, lines removed per author\nCommit Frequency:\n  --commit-frequency[=g]     g=daily|weekly|monthly (default daily)\n  --commit-frequency-by-author  Per-author daily counts\n  --commit-frequency-by-branch  Commits per branch (time filtered)\nBranches:\n  --branches                 List branches (name,lastCommitDate,lastAuthor,tip)\n  --branch-stats             Commits, merges, unique authors per branch\nCommit Stats:\n  --total-commits            Total commits in range\n  --average-commits-per-day  Average commits per day in range\n  --commit-distribution      Daily commit counts (date->count)\nFiles/Directories:\n  --file-stats               Stats per file (changes,additions,deletions)\n  --directory-stats          Aggregated stats per directory\nGeneral:\n  -h, --help                 Show help\nExamples:\n  node gitviz.js --contributors --top-contributors 5 --format json\n  node gitviz.js --commit-frequency=weekly --since 2025-06-01 --until 2025-06-30\n  node gitviz.js --file-stats --directory-stats --all\n`;
  console.log(help.trimEnd());
}
// ---------------- Git helpers ----------------
function runGit(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" });
  } catch (e) {
    const msg = e.stderr || e.stdout || e.message || "git command failed";
    console.error(msg.trim());
    process.exit(1);
  }
}
function ensureRepo(path) {
  try {
    runGit(["rev-parse", "--is-inside-work-tree"], path);
  } catch {
    console.error("Not a git repository");
    process.exit(1);
  }
}
function repoFirstCommitDate(path) {
  try {
    const out = runGit(
      ["log", "--date=short", "--pretty=format:%ad", "--reverse"],
      path
    ).trim();
    if (!out) return null;
    return out.split(/\r?\n/)[0];
  } catch {
    return null;
  }
}
// Build time filter arguments
function timeArgs(args) {
  const ta = [];
  if (args.since) ta.push(`--since=${args.since}`);
  if (args.until) ta.push(`--until=${args.until}`);
  if (!args.since && !args.until && args.days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (args.days - 1));
    ta.push(`--since=${fmtDate(start)}`);
    ta.push(`--until=${fmtDate(end)}`);
  }
  return ta;
}
// Collect basic commits (no numstat)
function collectCommitsBasic(cfg) {
  const sep = "\u0001";
  const format = `%H${sep}%h${sep}%an${sep}%ae${sep}%ad${sep}%P`;
  const cmd = ["log", "--date=short", `--pretty=format:${format}`];
  if (cfg.all) cmd.splice(1, 0, "--all");
  if (cfg.author) cmd.push(`--author=${cfg.author}`);
  cmd.push(...timeArgs(cfg));
  const out = runGit(cmd, cfg.repo);
  const commits = [];
  if (!out.trim()) return commits;
  out.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split(sep);
    if (parts.length < 6) return;
    const [hash, short, name, email, date, parents] = parts;
    commits.push({
      hash,
      short,
      authorName: name,
      authorEmail: email,
      date,
      parents: parents.trim().split(/\s+/).filter(Boolean),
    });
  });
  return commits;
}
// Collect commits with numstat if needed (file/author line stats)
function collectCommitsWithNumstat(cfg) {
  const sep = "\u0001";
  const header = `commit${sep}%H${sep}%an${sep}%ae${sep}%ad`;
  const cmd = ["log", "--date=short", `--pretty=format:${header}`, "--numstat"];
  if (cfg.all) cmd.splice(1, 0, "--all");
  if (cfg.author) cmd.push(`--author=${cfg.author}`);
  cmd.push(...timeArgs(cfg));
  const out = runGit(cmd, cfg.repo);
  const commits = []; // {hash,authorName,authorEmail,date,files:[{path,add,del}]}
  let current = null;
  out.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("commit" + sep)) {
      const parts = line.split(sep);
      // commit, hash, an, ae, ad
      if (current) commits.push(current);
      current = {
        hash: parts[1],
        authorName: parts[2],
        authorEmail: parts[3],
        date: parts[4],
        files: [],
      };
    } else if (line.trim()) {
      const m = line.split(/\t/);
      if (m.length === 3 && current) {
        const add = m[0] === "-" ? 0 : parseInt(m[0], 10) || 0;
        const del = m[1] === "-" ? 0 : parseInt(m[1], 10) || 0;
        current.files.push({ path: m[2], add, del });
      }
    }
  });
  if (current) commits.push(current);
  return commits;
}
function listBranches(repo) {
  const fmt = "%(refname:short)\t%(objectname:short)\t%(committerdate:short)";
  const out = runGit(["for-each-ref", "--format", fmt, "refs/heads"], repo);
  const branches = [];
  out.split(/\r?\n/).forEach((l) => {
    if (!l.trim()) return;
    const [name, tip, date] = l.split(/\t/);
    branches.push({ name, tip, date });
  });
  return branches;
}
// Branch last author
function branchLastAuthor(repo, branch, cfg) {
  const base = [
    "log",
    "-1",
    "--date=short",
    "--pretty=format:%an%x01%ae%x01%ad",
    branch,
  ];
  const out = runGit(base, repo).trim();
  if (!out) return null;
  const [an, ae, ad] = out.split("\u0001");
  return { authorName: an, authorEmail: ae, date: ad };
}
// ---------------- Calculations ----------------
function calcContributors(commits) {
  const map = {};
  commits.forEach((c) => {
    const k = `${c.authorName} <${c.authorEmail}>`;
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map)
    .map(([k, commits]) => {
      const m = k.match(/^(.*) <(.+)>$/);
      return { name: m ? m[1] : k, email: m ? m[2] : null, commits };
    })
    .sort((a, b) => b.commits - a.commits);
}
function calcContributorLineStats(numCommits) {
  const stats = {};
  numCommits.forEach((c) => {
    const key = `${c.authorName} <${c.authorEmail}>`;
    let entry = stats[key];
    if (!entry)
      entry = stats[key] = {
        name: c.authorName,
        email: c.authorEmail,
        commits: 0,
        additions: 0,
        deletions: 0,
      };
    entry.commits++;
    c.files.forEach((f) => {
      entry.additions += f.add;
      entry.deletions += f.del;
    });
  });
  return Object.values(stats).sort((a, b) => b.commits - a.commits);
}
function groupByDate(commits) {
  const m = {};
  commits.forEach((c) => {
    m[c.date] = (m[c.date] || 0) + 1;
  });
  return m;
}
function groupDailyByAuthor(commits) {
  const map = {};
  commits.forEach((c) => {
    const a = c.authorName;
    if (!map[a]) map[a] = {};
    map[a][c.date] = (map[a][c.date] || 0) + 1;
  });
  return map;
}
function frequencyAggregate(commits, granularity) {
  const agg = {};
  commits.forEach((c) => {
    let key = c.date; // YYYY-MM-DD
    if (granularity === "weekly") {
      // ISO week (year-week)
      const d = new Date(c.date + "T00:00:00Z");
      const temp = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const dayNum = Math.floor((d - temp) / 86400000) + 1;
      const week = Math.ceil(dayNum / 7);
      key = `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    } else if (granularity === "monthly") key = c.date.slice(0, 7);
    agg[key] = (agg[key] || 0) + 1;
  });
  return agg;
}
function calcCommitDistribution(commits) {
  return groupByDate(commits);
}
function calcAveragePerDay(total, since, until) {
  if (!total) return 0;
  const days = diffDaysInclusive(since, until);
  return days > 0 ? +(total / days).toFixed(2) : 0;
}
function fileStats(numCommits) {
  const map = {}; // path -> {changes, additions, deletions}
  numCommits.forEach((c) => {
    const seen = new Set();
    c.files.forEach((f) => {
      const e =
        map[f.path] ||
        (map[f.path] = {
          path: f.path,
          changes: 0,
          additions: 0,
          deletions: 0,
        });
      e.additions += f.add;
      e.deletions += f.del;
      if (!seen.has(f.path)) {
        e.changes++;
        seen.add(f.path);
      }
    });
  });
  return Object.values(map).sort(
    (a, b) =>
      b.changes - a.changes ||
      b.additions + b.deletions - (a.additions + a.deletions)
  );
}
function directoryStats(fileStatsList) {
  const map = {};
  fileStatsList.forEach((f) => {
    const dir = f.path.includes("/")
      ? f.path.split("/").slice(0, -1).join("/")
      : ".";
    const e =
      map[dir] ||
      (map[dir] = { directory: dir, changes: 0, additions: 0, deletions: 0 });
    e.changes += f.changes;
    e.additions += f.additions;
    e.deletions += f.deletions;
  });
  return Object.values(map).sort(
    (a, b) =>
      b.changes - a.changes ||
      b.additions + b.deletions - (a.additions + a.deletions)
  );
}
function branchCommitCounts(repo, branches, cfg) {
  const counts = {};
  const t = timeArgs(cfg); // since/until
  branches.forEach((b) => {
    const cmd = ["rev-list", b.name, "--count", ...t];
    const out = runGit(cmd, repo).trim();
    counts[b.name] = parseInt(out, 10) || 0;
  });
  return counts;
}
function branchStats(repo, branches, cfg) {
  const t = timeArgs(cfg);
  return branches.map((b) => {
    let commits = 0,
      merges = 0,
      authors = 0;
    try {
      commits =
        parseInt(
          runGit(["rev-list", b.name, "--count", ...t], repo).trim(),
          10
        ) || 0;
    } catch {}
    try {
      merges =
        parseInt(
          runGit(
            ["rev-list", b.name, "--merges", "--count", ...t],
            repo
          ).trim(),
          10
        ) || 0;
    } catch {}
    try {
      const out = runGit(["log", b.name, "--pretty=format:%an", ...t], repo);
      const set = new Set(out.split(/\r?\n/).filter(Boolean));
      authors = set.size;
    } catch {}
    return { branch: b.name, commits, merges, authors };
  });
}
// ---------------- Output helpers ----------------
function outputPlain(sections) {
  const order = Object.keys(sections);
  order.forEach((k, idx) => {
    const val = sections[k];
    if (Array.isArray(val)) {
      console.log(`${k}:`);
      val.forEach((v) => {
        console.log(JSON.stringify(v));
      });
    } else if (val && typeof val === "object") {
      console.log(`${k}:`);
      console.log(JSON.stringify(val));
    } else {
      console.log(`${k}: ${val}`);
    }
    if (idx !== order.length - 1) console.log("");
  });
}
// ---------------- Main ----------------
(function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!fs.existsSync(args.repo)) {
    console.error("Repo path not found");
    process.exit(1);
  }
  ensureRepo(args.repo);
  // Determine since/until fallback using repo age if not provided
  if (!args.since && !args.until && !args.days) {
    // default: last 30 days if commits exist
    args.days = 30;
  }
  // If until not given but since given, until=today
  if (args.since && !args.until) args.until = fmtDate(new Date());
  if (args.until && !args.since && args.days) {
    // ignore days if until provided but not since
    const end = new Date(args.until + "T00:00:00");
    const start = new Date(end);
    start.setDate(end.getDate() - (args.days - 1));
    args.since = fmtDate(start);
  }
  const firstDate = repoFirstCommitDate(args.repo);
  const repoAgeDays = firstDate
    ? diffDaysInclusive(firstDate, fmtDate(new Date()))
    : 0;

  // Decide which data sets are needed
  const needCommitsBasic = [
    args.commitFrequency,
    args.commitFrequencyByAuthor,
    args.commitFrequencyByBranch,
    args.branches,
    args.branchStats,
    args.totalCommits,
    args.averageCommitsPerDay,
    args.commitDistribution,
    args.contributors,
    args.topContributors != null,
    args.contributorStats,
  ].some(Boolean);
  const needNumstat =
    args.fileStats || args.directoryStats || args.contributorStats;

  const sections = {};
  let commitsBasic = [];
  let commitsNum = [];
  if (needCommitsBasic) commitsBasic = collectCommitsBasic(args);
  if (needNumstat) commitsNum = collectCommitsWithNumstat(args);

  // Determine effective date range for averages
  let effectiveSince = args.since;
  let effectiveUntil = args.until;
  if (!effectiveSince || !effectiveUntil) {
    // derive from commits if possible
    if (commitsBasic.length) {
      const dates = commitsBasic.map((c) => c.date).sort();
      if (!effectiveSince) effectiveSince = dates[0];
      if (!effectiveUntil) effectiveUntil = dates[dates.length - 1];
    } else if (commitsNum.length) {
      const dates = commitsNum.map((c) => c.date).sort();
      if (!effectiveSince) effectiveSince = dates[0];
      if (!effectiveUntil) effectiveUntil = dates[dates.length - 1];
    } else if (!effectiveSince && args.days) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (args.days - 1));
      effectiveSince = fmtDate(start);
      effectiveUntil = fmtDate(end);
    }
  }
  // Contributors basic list
  if (args.contributors || args.topContributors != null) {
    const list = calcContributors(
      commitsBasic.length ? commitsBasic : commitsNum
    );
    const topN =
      args.topContributors != null ? args.topContributors : list.length;
    sections.contributors = list.slice(0, topN);
  }
  if (args.contributorStats) {
    const stats = calcContributorLineStats(commitsNum);
    sections.contributorStats = stats;
  }
  if (args.commitFrequency) {
    const gran = ["daily", "weekly", "monthly"].includes(args.commitFrequency)
      ? args.commitFrequency
      : "daily";
    sections.commitFrequency = frequencyAggregate(commitsBasic, gran);
  }
  if (args.commitFrequencyByAuthor) {
    sections.commitFrequencyByAuthor = groupDailyByAuthor(commitsBasic);
  }
  if (args.commitFrequencyByBranch) {
    const branches = listBranches(args.repo);
    sections.commitFrequencyByBranch = branchCommitCounts(
      args.repo,
      branches,
      args
    );
  }
  if (args.branches) {
    const branches = listBranches(args.repo).map((b) => {
      const last = branchLastAuthor(args.repo, b.name, args) || {};
      return {
        name: b.name,
        tip: b.tip,
        lastCommitDate: b.date,
        lastAuthor: last.authorName || null,
        lastAuthorEmail: last.authorEmail || null,
      };
    });
    sections.branches = branches;
  }
  if (args.branchStats) {
    const branches = listBranches(args.repo);
    sections.branchStats = branchStats(args.repo, branches, args);
  }
  if (args.totalCommits)
    sections.totalCommits = commitsBasic.length || commitsNum.length;
  if (args.commitDistribution)
    sections.commitDistribution = calcCommitDistribution(commitsBasic);
  if (args.averageCommitsPerDay) {
    const total = commitsBasic.length || commitsNum.length;
    if (effectiveSince && effectiveUntil)
      sections.averageCommitsPerDay = calcAveragePerDay(
        total,
        effectiveSince,
        effectiveUntil
      );
    else sections.averageCommitsPerDay = 0;
  }
  if (args.fileStats) {
    const fsList = fileStats(commitsNum);
    sections.fileStats = fsList;
  }
  if (args.directoryStats) {
    const fsList = sections.fileStats || fileStats(commitsNum);
    sections.directoryStats = directoryStats(fsList);
  }
  // Always include meta if JSON (not counted as a requested section but helpful)
  const anyRequested = Object.keys(sections).length > 0;
  if (!anyRequested) {
    printHelp();
    return;
  }
  if (args.format === "json") {
    sections.meta = {
      repo: args.repo,
      since: effectiveSince || null,
      until: effectiveUntil || null,
      repoAgeDays,
      generated: new Date().toISOString(),
    };
    console.log(JSON.stringify(sections, null, 2));
  } else {
    outputPlain(sections);
  }
})();
