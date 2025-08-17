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
        topContributors: null, // number (set via --top)
        contributorStats: false,
        meta: false, // include meta section in JSON only when --meta is passed
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
        // Generic --key[value] support
        if (
            t.startsWith("--") &&
            t.includes("[") &&
            t.endsWith("]") &&
            !t.includes(" ")
        ) {
            const m = t.match(/^--([a-z0-9-]+)\[(.*)\]$/i);
            if (m) {
                const flag = `--${m[1]}`;
                const val = m[2] === "" ? null : m[2];
                switch (flag) {
                    case "--repo":
                        if (val) args.repo = val;
                        break;
                    case "--author":
                        if (val) args.author = val;
                        break;
                    case "--days":
                        args.days = val ? parseInt(val, 10) || null : null;
                        break;
                    case "--top":
                        args.topContributors = val ? parseInt(val, 10) || 10 : 10;
                        args.contributors = true;
                        break;
                    case "--format":
                        if (val) args.format = val.toLowerCase();
                        break;
                    case "--commit-frequency":
                        args.commitFrequency = val || "daily";
                        break;
                    case "--meta":
                        args.meta = true;
                        break;
                    case "--since":
                        if (val) args.since = val;
                        break;
                    case "--until":
                        if (val) args.until = val;
                        break;
                    default:
                        // ignore unknown bracket flag
                        break;
                }
                continue; // move to next arg
            }
        }
        // Generic --key=value support for options we recognize
        if (t.startsWith("--") && t.includes("=")) {
            const [flag, valRaw] = t.split(/=(.+)/); // keep everything after first =
            const val = valRaw === undefined || valRaw === "" ? null : valRaw;
            switch (flag) {
                case "--repo":
                    if (val) args.repo = val;
                    continue;
                case "--author":
                    if (val) args.author = val;
                    continue;
                case "--days":
                    args.days = val ? parseInt(val, 10) || null : null;
                    continue;
                case "--top":
                    args.topContributors = val ? parseInt(val, 10) || 10 : 10;
                    args.contributors = true;
                    continue;
                case "--format":
                    if (val) args.format = val.toLowerCase();
                    continue;
                case "--json": // treat --json=anything as enabling json output
                    args.format = "json";
                    continue;
                case "--commit-frequency":
                    args.commitFrequency = val || "daily";
                    continue;
                case "--meta":
                    args.meta = true;
                    continue;
                // since/until already handled below but accept here too
                case "--since":
                    if (val) args.since = val;
                    continue;
                case "--until":
                    if (val) args.until = val;
                    continue;
            }
        }
        if (t === "--repo") args.repo = next();
        else if (t === "--all") args.all = true;
        else if (t === "--author") args.author = next();
        else if (t === "--days") args.days = parseInt(next(), 10) || null;
        else if (t.startsWith("--since"))
            args.since = t.includes("=") ? t.split("=")[1] : next();
        else if (t.startsWith("--until"))
            args.until = t.includes("=") ? t.split("=")[1] : next();
        else if (t === "--contributors") args.contributors = true;
        else if (t === "--contributor-stats") args.contributorStats = true;
        else if (t === "--commit-frequency-by-author")
            args.commitFrequencyByAuthor = true;
        else if (t === "--commit-frequency-by-branch")
            args.commitFrequencyByBranch = true;
        else if (t.startsWith("--commit-frequency")) {
            // Support forms:
            // --commit-frequency (defaults daily)
            // --commit-frequency <value>
            // ( = and [ ] handled earlier )
            if (t.includes("=")) {
                /* already handled earlier, ignore here */
            } else {
                const peek = argv[i + 1];
                if (peek && !peek.startsWith("-")) {
                    args.commitFrequency = next() || "daily";
                } else {
                    args.commitFrequency = "daily";
                }
            }
        } else if (t === "--branches") args.branches = true;
        else if (t === "--branch-stats") args.branchStats = true;
        else if (t === "--total-commits") args.totalCommits = true;
        else if (t === "--average-commits-per-day")
            args.averageCommitsPerDay = true;
        else if (t === "--commit-distribution") args.commitDistribution = true;
        else if (t === "--file-stats") args.fileStats = true;
        else if (t === "--directory-stats") args.directoryStats = true;
        else if (t === "--format") args.format = (next() || "text").toLowerCase();
        else if (t === "--json") args.format = "json";
        else if (t === "--meta") args.meta = true;
        else if (t === "-h" || t === "--help") args.help = true;
        // Backward compatibility (ignored aesthetics): --width --top --limit-branches --no-* are ignored now
        else if (t === "--top") {
            const peek = argv[i + 1];
            if (peek && !peek.startsWith("-")) {
                args.topContributors = parseInt(next(), 10) || 10;
            } else if (args.topContributors == null) {
                args.topContributors = 10; // default if no number supplied
            }
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
    const help = `Git Log Visualizer CLI (plain output)\nUsage: node gitviz.js [options]\nTime Filters:\n  --since <YYYY-MM-DD>       Start date inclusive\n  --until <YYYY-MM-DD>       End date inclusive\n  --days <n>                 (Legacy) last n days (ignored if --since provided)\nScope Filters:\n  --repo <path>              Repository path (default .)\n  --all                      Include all refs\n  --author <pattern>         Filter by author (git regex)\nOutput Format:\n  --format json|text         Default text\n  --json                     Shorthand for --format json\n  --meta                     Include meta (repo, since, until, age, generated) (JSON: section; text: prepended)\nContributors:\n  --contributors             List contributors (name,email,commits)\n  --top <n>                  Top N contributors (implies --contributors)\n  --contributor-stats        Commits, lines added, lines removed per author\nCommit Frequency:\n  --commit-frequency[=g]     g=daily|weekly|monthly (default daily)\n  --commit-frequency-by-author  Per-author daily counts\n  --commit-frequency-by-branch  Commits per branch (time filtered)\nBranches:\n  --branches                 List branches (name,lastCommitDate,lastAuthor,tip)\n  --branch-stats             Commits, merges, unique authors per branch\nCommit Stats:\n  --total-commits            Total commits in range\n  --average-commits-per-day  Average commits per day in range\n  --commit-distribution      Daily commit counts (date->count)\nFiles/Directories:\n  --file-stats               Stats per file (changes,additions,deletions)\n  --directory-stats          Aggregated stats per directory\nGeneral:\n  -h, --help                 Show help\nExamples:\n  node gitviz.js --contributors --top 5 --json --meta\n  node gitviz.js --commit-frequency=weekly --since 2025-06-01 --until 2025-06-30\n  node gitviz.js --file-stats --directory-stats --all\n`;
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
            authors = 0,
            authorList = [];
        try {
            commits =
                parseInt(
                    runGit(["rev-list", b.name, "--count", ...t], repo).trim(),
                    10
                ) || 0;
        } catch { }
        try {
            merges =
                parseInt(
                    runGit(
                        ["rev-list", b.name, "--merges", "--count", ...t],
                        repo
                    ).trim(),
                    10
                ) || 0;
        } catch { }
        try {
            const fmt = "%an%x01%ae"; // name + email
            const args = ["log", b.name, `--pretty=format:${fmt}`, ...t];
            if (cfg.author) args.push(`--author=${cfg.author}`);
            const out = runGit(args, repo);
            const set = new Set();
            out
                .split(/\r?\n/)
                .filter(Boolean)
                .forEach((line) => {
                    const parts = line.split("\x01");
                    if (parts.length === 2) {
                        const entry = `${parts[0]} <${parts[1]}>`;
                        set.add(entry);
                    } else {
                        set.add(line); // fallback
                    }
                });
            authors = set.size;
            authorList = Array.from(set).sort();
        } catch { }
        return { branch: b.name, commits, merges, authors, authorList };
    });
}
// ---------------- Output helpers ----------------
function outputPlain(sections) {
    // Plain format rule: one logical fact per line in key[:more.key...] form
    // Primitives: key: value
    // Objects: key.sub: value
    // Arrays: key[index]: value (primitive) OR key[index].sub: value (object)
    // Empty collections still noted (e.g., key: [] / key: {})
    const order = Object.keys(sections);
    const lines = [];
    const push = (l) => lines.push(l);
    function emit(key, value, depth = 1) {
        // emit flattens any value into one-or-more 'key: value' lines, recursing
        // for objects/arrays. It pushes the resulting strings into lines[].
        if (value === null || value === undefined) {
            push(`${key}: null`);
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                push(`${key}: []`);
                return;
            }
            // Special case: authorList (array of strings) -> emit each as 'author: value'
            if (key === "authorList" && value.every((v) => typeof v === "string")) {
                value.forEach((item) => push(`author: ${item}`));
                return;
            }
            value.forEach((item, idx) => {
                const base = `${key}[${idx}]`;
                if (item === null || item === undefined) {
                    push(`${base}: null`);
                } else if (Array.isArray(item)) {
                    // Rare: nested array, flatten primitive items
                    if (item.length === 0) push(`${base}: []`);
                    else item.forEach((inner, j) => emit(`${base}[${j}]`, inner));
                } else if (typeof item === "object") {
                    const keys = Object.keys(item);
                    if (keys.length === 0) push(`${base}: {}`);
                    else {
                        // For arrays of objects we now omit the 'section[index].' prefix for cleaner output.
                        // Just print each field name directly (still grouped by blank line separation).
                        keys.forEach((k) => emit(k, item[k], depth + 1));
                    }
                } else {
                    push(`${base}: ${item}`);
                }
                // Blank line separator between distinct objects/entries (not after last)
                if (idx !== value.length - 1 && key !== "authorList") push("");
            });
        } else if (typeof value === "object") {
            // Special formatting: commitFrequencyByAuthor => blocks: author + its dates
            if (
                key === "commitFrequencyByAuthor" &&
                depth === 1 &&
                Object.values(value).every((v) => typeof v === "object" && v !== null)
            ) {
                const authorNames = Object.keys(value);
                authorNames.forEach((author, idx) => {
                    push(`author: ${author}`);
                    const dateMap = value[author];
                    // Preserve exact keys; don't trim / reorder beyond sort by date ascending
                    Object.keys(dateMap)
                        .sort()
                        .forEach((d) => push(`${d}: ${dateMap[d]}`));
                    if (idx !== authorNames.length - 1) push("");
                });
                return;
            }
            const keys = Object.keys(value);
            if (keys.length === 0) {
                push(`${key}: {}`);
            } else {
                // If this is a top-level simple object (all primitive values), drop the 'section.' prefix.
                const allPrimitive =
                    depth === 1 &&
                    keys.every((k) => {
                        const v = value[k];
                        return v === null || v === undefined || typeof v !== "object";
                    });
                if (allPrimitive) {
                    keys.forEach((k) => emit(k, value[k], depth + 1));
                } else {
                    keys.forEach((k) => emit(`${key}.${k}`, value[k], depth + 1));
                }
            }
        } else {
            push(`${key}: ${value}`);
        }
    }
    order.forEach((k) => emit(k, sections[k], 1));
    console.log(lines.join("\n"));
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
    const anyRequested = Object.keys(sections).length > 0 || args.meta;
    if (!anyRequested) {
        printHelp();
        return;
    }
    if (args.format === "json") {
        if (args.meta) {
            sections.meta = {
                repo: args.repo,
                since: effectiveSince || null,
                until: effectiveUntil || null,
                repoAgeDays,
                generated: new Date().toISOString(),
            };
        }
        console.log(JSON.stringify(sections, null, 2));
    } else {
        if (args.meta) {
            const metaLines = [
                `repo: ${args.repo}`,
                `since: ${effectiveSince || "null"}`,
                `until: ${effectiveUntil || "null"}`,
                `repoAgeDays: ${repoAgeDays}`,
                `generated: ${new Date().toISOString()}`,
            ];
            console.log(metaLines.join("\n"));
            if (Object.keys(sections).length) console.log(""); // blank line only if more follows
        }
        if (Object.keys(sections).length) outputPlain(sections);
    }
})();
