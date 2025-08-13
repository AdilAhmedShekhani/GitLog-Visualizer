#!/usr/bin/env node
/**
 * Git Log Visualizer (CLI) — Node.js (no external deps)
 * Shows: commit frequency (last N days), top contributors, branches summary
 *
 * Usage examples:
 *   node gitviz.js
 *   node gitviz.js --days 14 --all
 *   node gitviz.js --author "Adil" --days 90 --width 60
 *   node gitviz.js --repo /path/to/repo
 *
 * Tip: Run inside a git repository (or pass --repo). Use --help for options.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

// ========= Small utilities =========
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
};
const isTTY = process.stdout.isTTY;
const color = (s, c) => (isTTY ? c + s + COLORS.reset : s);

function padRight(str, len) {
  return (str + " ".repeat(len)).slice(0, len);
}
function padLeft(str, len) {
  str = String(str);
  return (" ".repeat(len) + str).slice(-len);
}

function parseArgs(argv) {
  const out = {
    repo: ".",
    days: 30,
    all: false,
    author: null,
    width: 40,
    top: 10,
    limitBranches: 15,
    noBranches: false,
    noContrib: false,
    noGraph: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    const next = () => argv[++i];
    switch (tok) {
      case "--repo": out.repo = next(); break;
      case "--days": out.days = parseInt(next(), 10) || 30; break;
      case "--all": out.all = true; break;
      case "--author": out.author = next(); break;
      case "--width": out.width = parseInt(next(), 10) || 40; break;
      case "--top": out.top = parseInt(next(), 10) || 10; break;
      case "--limit-branches": out.limitBranches = parseInt(next(), 10) || 15; break;
      case "--no-branches": out.noBranches = true; break;
      case "--no-contrib": out.noContrib = true; break;
      case "--no-graph": out.noGraph = true; break;
      case "-h": case "--help": out.help = true; break;
      default: /* ignore unknown */ break;
    }
  }
  return out;
}

function printHelp() {
  const lines = [
    color("Git Log Visualizer (CLI) — Node.js", COLORS.bold),
    "",
    "Options:",
    "  --repo <path>            Path to git repository (default: .)",
    "  --days <n>               Days to include (default: 30)",
    "  --all                    Include commits from all refs/branches",
    "  --author <pattern>       Filter commits by author (supports git regex)",
    "  --width <n>              Width of ASCII bars (default: 40)",
    "  --top <n>                Top contributors to show (default: 10)",
    "  --limit-branches <n>     Max local branches to list (default: 15)",
    "  --no-branches            Hide branches section",
    "  --no-contrib             Hide contributors section",
    "  --no-graph               Hide commit frequency graph",
    "  -h, --help               Show this help",
    "",
    "Examples:",
    "  node gitviz.js",
    "  node gitviz.js --all --days 90 --width 60",
    "  node gitviz.js --author 'Adil'",
    "  node gitviz.js --repo ../some-repo",
  ];
  console.log(lines.join("\n"));
}

// ========= Git helpers =========
function runGit(args, cwd = ".") {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" });
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("Error: 'git' command not found. Install Git and ensure it's on PATH.");
    } else if (err.stdout || err.stderr) {
      console.error("Git command failed:\n" + (err.stdout || err.stderr));
    } else {
      console.error("Git command failed.");
    }
    process.exit(1);
  }
}

function ensureGitRepo(cwd = ".") {
  try {
    runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  } catch (_) {
    console.error("Error: Not a git repository (or any of the parent directories). Use --repo.");
    process.exit(1);
  }
}

// ========= Data collection =========
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daterangeList(days) {
  const today = new Date();
  const arr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(fmtDate(d));
  }
  return arr; // oldest -> newest
}

function parseGitLog(days, includeAll, author, cwd = ".") {
  const fmt = "%h|%an|%ad|%s";
  const args = ["log", "--date=short", `--pretty=format:${fmt}`];
  if (includeAll) args.unshift("--all"); // insert after git
  if (author) args.push(`--author=${author}`);
  if (days && days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    args.push(`--since=${fmtDate(since)}`);
  }
  const out = runGit(args, cwd);
  const commits = [];
  out.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split("|", 4);
    if (parts.length < 4) return;
    const [hash, authorName, date, message] = parts.map((s) => s.trim());
    commits.push({ hash, author: authorName, date, message });
  });
  return commits;
}

function makeHistogram(byDay, days, width) {
  const labels = daterangeList(days);
  const values = labels.map((d) => byDay[d] || 0);
  const max = values.length ? Math.max(...values) : 0;
  const lines = [];
  for (let i = 0; i < labels.length; i++) {
    const v = values[i];
    const barLen = max > 0 ? Math.round((v / max) * width) : 0;
    const bar = "█".repeat(barLen);
    lines.push(`${labels[i]} | ${bar} ${v}`);
  }
  return { lines, max };
}

function countBy(arr, keyFn) {
  const m = Object.create(null);
  for (const item of arr) {
    const k = keyFn(item);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function contributorsSummary(commits) {
  const counts = countBy(commits, (c) => c.author);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return { entries, total };
}

function branchesSummary(limit, cwd = ".") {
  // Mark current branch with '*'
  const fmt = "%(if)%(HEAD)%(then)*%(else) %(end)%(refname:short)|%(committerdate:short)|%(objectname:short)";
  const out = runGit(["for-each-ref", "--sort=-committerdate", `--format=${fmt}`, "refs/heads/"], cwd);
  const branches = [];
  out.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const current = line.startsWith("*");
    const rest = line.slice(1).trim();
    const parts = rest.split("|");
    if (parts.length < 3) return;
    const [name, lastDate, tip] = parts;
    let count = 0;
    try {
      const cnt = runGit(["rev-list", "--count", name], cwd).trim();
      count = parseInt(cnt, 10) || 0;
    } catch (_) {}
    branches.push({ name, current, lastDate, tip, count });
  });
  return limit > 0 ? branches.slice(0, limit) : branches;
}

// ========= Printers =========
function header(title) {
  console.log("\n" + color(title, COLORS.bold));
  console.log(color("―".repeat(title.length), COLORS.blue));
}

function printCommitFrequency(commits, days, width) {
  const byDay = {};
  for (const c of commits) byDay[c.date] = (byDay[c.date] || 0) + 1;
  header(`Commit Frequency (last ${days} days)`);
  const { lines, max } = makeHistogram(byDay, days, width);
  if (max === 0) {
    console.log("No commits in the selected time range.");
  } else {
    lines.forEach((ln) => console.log(ln));
  }
}

function printContributors(commits, topN = 10) {
  header("Top Contributors (within selected range)");
  const { entries, total } = contributorsSummary(commits);
  if (total === 0) return console.log("No commits found.");
  console.log(`Total commits: ${total}`);
  console.log(`${padLeft('#', 2)}  ${padRight('Author', 30)} ${padLeft('Commits', 7)} ${padLeft('Share', 7)}`);
  console.log("-".repeat(52));
  entries.slice(0, topN).forEach(([name, cnt], i) => {
    const share = total ? ((cnt / total) * 100).toFixed(1) : "0.0";
    const trimmed = name.length > 30 ? name.slice(0, 27) + "..." : name;
    console.log(`${padLeft(i + 1, 2)}  ${padRight(trimmed, 30)} ${padLeft(cnt, 7)} ${padLeft(share + '%', 7)}`);
  });
}

function printBranches(branches) {
  header("Branches (local)");
  if (!branches.length) return console.log("No branches found.");
  console.log(`${" ".repeat(1)}${padRight('Branch', 30)} ${padLeft('Commits', 7)}  ${padRight('Last Commit', 12)}  ${padRight('Tip', 8)}`);
  console.log("-".repeat(65));
  for (const b of branches) {
    const star = b.current ? "*" : " ";
    const name = b.name.length > 30 ? b.name.slice(0, 27) + "..." : b.name;
    console.log(`${star}${padRight(name, 30)} ${padLeft(b.count, 7)}  ${padRight(b.lastDate, 12)}  ${padRight(b.tip, 8)}`);
  }
}

// ========= Main =========
(function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  // Validate repo
  if (!fs.existsSync(args.repo)) {
    console.error(`Error: repo path not found: ${args.repo}`);
    process.exit(1);
  }
  ensureGitRepo(args.repo);

  // Collect commits
  const commits = parseGitLog(args.days, args.all, args.author, args.repo);

  // Header/meta
  console.log(color("Git Log Visualizer (CLI) — Node.js", COLORS.bold));
  console.log(color(`Repo: ${args.repo}`, COLORS.cyan));
  const now = new Date();
  const stamp = `${fmtDate(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  console.log(color(`Analyzed on: ${stamp}`, COLORS.dim));
  let meta = `Scope: ${args.all ? '--all' : 'current branch'}, Window: last ${args.days} days`;
  if (args.author) meta += `, Author filter: '${args.author}'`;
  console.log(color(meta, COLORS.dim));

  // Sections
  if (!args.noGraph) printCommitFrequency(commits, args.days, args.width);
  if (!args.noContrib) printContributors(commits, args.top);
  if (!args.noBranches) {
    const brs = branchesSummary(args.limitBranches, args.repo);
    printBranches(brs);
  }
})();