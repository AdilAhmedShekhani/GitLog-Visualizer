#!/usr/bin/env node
/**
 * GitViz Decorative Terminal Dashboard (no external dependencies)
 * Uses the existing gitviz CLI via a single JSON invocation.
 * Good variable names preserved for clarity.
 */

const { execSync } = require("child_process");
const fs = require("fs");

// ----------------------------- Configuration -----------------------------
const DEFAULT_TOP_CONTRIBUTORS_LIMIT = 10;
const DEFAULT_TOP_FILES_LIMIT = 10;

// Allow simple flag overrides for counts (e.g. --top 5 --files 15)
function parseDashboardFlags(argv) {
  const dashboardFlags = {
    topContributorsLimit: DEFAULT_TOP_CONTRIBUTORS_LIMIT,
    topFilesLimit: DEFAULT_TOP_FILES_LIMIT,
    showBranches: true,
    showFiles: true,
    colorEnabled: process.stdout.isTTY && !process.env.NO_COLOR,
    repoPath: ".",
    passThrough: [], // arbitrary extra gitviz CLI flags (e.g. --since, --until, --author, --all, etc.)
    splitBranchSections: false, // show separate Branches + Branch Stats tables instead of merged one
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = () => argv[++i];
    if (token === "--top")
      dashboardFlags.topContributorsLimit =
        parseInt(next(), 10) || DEFAULT_TOP_CONTRIBUTORS_LIMIT;
    else if (token.startsWith("--top="))
      dashboardFlags.topContributorsLimit =
        parseInt(token.split("=")[1], 10) || DEFAULT_TOP_CONTRIBUTORS_LIMIT;
    else if (token === "--files")
      dashboardFlags.topFilesLimit =
        parseInt(next(), 10) || DEFAULT_TOP_FILES_LIMIT;
    else if (token.startsWith("--files="))
      dashboardFlags.topFilesLimit =
        parseInt(token.split("=")[1], 10) || DEFAULT_TOP_FILES_LIMIT;
    else if (token === "--no-branches") dashboardFlags.showBranches = false;
    else if (token === "--no-files") dashboardFlags.showFiles = false;
    else if (token === "--no-color") dashboardFlags.colorEnabled = false;
    else if (token === "--repo") dashboardFlags.repoPath = next();
    else if (token.startsWith("--repo="))
      dashboardFlags.repoPath = token.split(/=(.+)/)[1] || ".";
    else if (token === "--split-branch-sections")
      dashboardFlags.splitBranchSections = true;
    else if (token === "--") {
      // everything after -- goes straight through
      dashboardFlags.passThrough.push(...argv.slice(i + 1));
      break;
    } else if (token.startsWith("--")) {
      // generic passthrough (capture optional value form --flag value)
      const lookahead = argv[i + 1];
      if (
        lookahead &&
        !lookahead.startsWith("--") &&
        !lookahead.startsWith("-")
      ) {
        dashboardFlags.passThrough.push(token, lookahead);
        i++; // consume value
      } else {
        dashboardFlags.passThrough.push(token);
      }
    }
  }
  return dashboardFlags;
}

// ---------------------------- CLI Data Fetch -----------------------------
function buildGitVizAggregateCommand(dashboardFlags) {
  const flags = [
    "--json",
    "--meta",
    // --top implies --contributors internally
    `--top ${dashboardFlags.topContributorsLimit}`,
    "--commit-frequency=daily",
    "--total-commits",
    "--average-commits-per-day",
  ];
  if (dashboardFlags.showBranches)
    flags.push("--branches", "--branch-stats", "--commit-frequency-by-branch");
  if (dashboardFlags.showFiles) flags.push("--file-stats", "--directory-stats");
  if (dashboardFlags.repoPath && dashboardFlags.repoPath !== ".") {
    const quoted = /\s/.test(dashboardFlags.repoPath)
      ? `"${dashboardFlags.repoPath.replace(/"/g, '\\"')}"`
      : dashboardFlags.repoPath;
    flags.push(`--repo ${quoted}`);
  }
  if (dashboardFlags.passThrough.length) {
    // join preserving order; if tokens contain spaces already they are assumed quoted
    flags.push(...dashboardFlags.passThrough);
  }
  return `node gitviz-cli.js ${flags.join(" ")}`;
}

function runGitVizAggregate(dashboardFlags) {
  const command = buildGitVizAggregateCommand(dashboardFlags);
  
  try {
    const rawOutput = execSync(command, { encoding: "utf8" });
    // fs.writeFileSync("debug0.json", rawOutput);
    const jsonOutput = JSON.parse(rawOutput);
    // fs.writeFileSync("debug1.json", jsonOutput);
    return jsonOutput
  } catch (error) {
    console.error("Failed to execute gitviz CLI.");
    console.error("Command:", command);
    console.error(error.stdout || error.message);
    process.exit(1);
  }
}

// ----------------------------- Formatting -------------------------------
const ANSI_CODES = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function colorize(text, colorCode, enabled) {
  return enabled ? colorCode + text + ANSI_CODES.reset : text;
}

function repeatChar(char, count) {
  return char.repeat(Math.max(0, count));
}

function getTerminalWidth() {
  return process.stdout.columns || 100;
}

function horizontalRule(char = "─") {
  return repeatChar(char, Math.min(getTerminalWidth(), 120));
}

function centerText(text) {
  const width = getTerminalWidth();
  if (text.length >= width) return text.slice(0, width);
  const padSize = width - text.length;
  const left = Math.floor(padSize / 2);
  const right = padSize - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

function truncateText(value, width) {
  return value.length > width ? value.slice(0, width - 1) + "…" : value;
}

function padCell(value, width, align = "left") {
  const raw = truncateText(String(value), width);
  return align === "right" ? raw.padStart(width) : raw.padEnd(width);
}

function renderTable(rowMatrix, columnDefinitions, colorEnabled) {
  if (!rowMatrix.length) return "(no data)";
  const headerRow = columnDefinitions
    .map((col) =>
      colorize(
        padCell(col.header, col.width, col.align),
        ANSI_CODES.bold,
        colorEnabled
      )
    )
    .join(" ");
  const dividerRow = columnDefinitions
    .map((col) => repeatChar("-", col.width))
    .join(" ");
  const bodyRows = rowMatrix
    .map((r) =>
      r
        .map((cell, idx) => {
          const def = columnDefinitions[idx];
          return padCell(cell == null ? "" : cell, def.width, def.align);
        })
        .join(" ")
    )
    .join("\n");
  return headerRow + "\n" + dividerRow + "\n" + bodyRows;
}

function computeContributorPercentages(contributors) {
  const totalCommits =
    contributors.reduce((sum, c) => sum + (c.commits || 0), 0) || 0;
  return contributors.map((c) => ({
    name: c.name,
    email: c.email,
    commits: c.commits,
    percent: totalCommits
      ? ((c.commits / totalCommits) * 100).toFixed(1)
      : "0.0",
  }));
}

function buildSparkline(dailyMap, maxPoints = 30) {
  const dateKeys = Object.keys(dailyMap || {}).sort();
  if (!dateKeys.length) return "(no commit frequency)";
  const sliceKeys = dateKeys.slice(-maxPoints);
  const values = sliceKeys.map((k) => dailyMap[k]);
  const maxValue = Math.max(...values);
  if (maxValue === 0) return "(all zero)";
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  return (
    values
      .map((v) => blocks[Math.round((v / maxValue) * (blocks.length - 1))])
      .join("") + ` max:${maxValue}`
  );
}

function twoColumnDetail(pairs) {
  const leftWidth = Math.max(...pairs.map((p) => p[0].length));
  return pairs.map(([l, r]) => l.padEnd(leftWidth + 2) + r).join("\n");
}

function printSectionHeader(title, colorEnabled) {
  console.log(
    colorize(centerText(` ${title} `), ANSI_CODES.cyan, colorEnabled)
  );
  console.log(horizontalRule());
}

// ----------------------------- Render Logic ------------------------------
function renderDashboard(dashboardFlags, gitVizData) {
  const colorEnabled = dashboardFlags.colorEnabled;
  const meta = gitVizData.meta || {};
  const contributors = gitVizData.contributors || [];
  const contributorPercents = computeContributorPercentages(contributors).slice(
    0,
    dashboardFlags.topContributorsLimit
  );
  const branchList = dashboardFlags.showBranches
    ? gitVizData.branches || []
    : [];
  const branchStats = dashboardFlags.showBranches
    ? gitVizData.branchStats || []
    : [];
  const fileStats = dashboardFlags.showFiles
    ? (gitVizData.fileStats || []).slice(0, dashboardFlags.topFilesLimit)
    : [];
  const directoryStats = dashboardFlags.showFiles
    ? gitVizData.directoryStats || []
    : [];
  const commitFrequencyDaily = gitVizData.commitFrequency || {};
  const commitFrequencyByBranch = gitVizData.commitFrequencyByBranch || {};
  const totalCommits = gitVizData.totalCommits;
  const averageCommitsPerDay = gitVizData.averageCommitsPerDay;

  // (Screen clear removed to avoid confusing cursor jump / disappearance)
  console.log(
    colorize(
      centerText(" GitViz CLI Dashboard "),
      ANSI_CODES.bold,
      colorEnabled
    )
  );
  console.log(horizontalRule());

  // Summary Panel
  const summaryPairs = [
    ["Repo", meta.repo === "." ? ". (current directory)" : meta.repo || "?"],
    ["Range", `${meta.since || "?"} → ${meta.until || "?"}`],
    [
      "Repo Age (days)",
      meta.repoAgeDays != null ? String(meta.repoAgeDays) : "?",
    ],
    ["Total Commits", totalCommits != null ? String(totalCommits) : "?"],
    [
      "Avg Commits/Day",
      averageCommitsPerDay != null ? String(averageCommitsPerDay) : "?",
    ],
    ["Contributors", String(contributors.length)],
  ];
  if (dashboardFlags.showBranches)
    summaryPairs.push(["Branches", String(branchList.length)]);
  printSectionHeader("Summary", colorEnabled);
  console.log(twoColumnDetail(summaryPairs));
  console.log();

  // Activity Sparkline
  printSectionHeader("Daily Activity (Sparkline)", colorEnabled);
  console.log(buildSparkline(commitFrequencyDaily));
  console.log();

  // Contributors table
  printSectionHeader(
    `Top Contributors (limit ${dashboardFlags.topContributorsLimit})`,
    colorEnabled
  );
  const contributorRows = contributorPercents.map((c) => [
    `${c.name} <${c.email}>`,
    c.commits,
    c.percent + "%",
  ]);
  console.log(
    renderTable(
      contributorRows,
      [
        { header: "Contributor", width: 90, align: "left" },
        { header: "Commits", width: 8, align: "right" },
        { header: "%", width: 6, align: "right" },
      ],
      colorEnabled
    )
  );
  console.log();

  if (dashboardFlags.showBranches) {
    if (dashboardFlags.splitBranchSections) {
      // Original separate tables
      printSectionHeader("Branches", colorEnabled);
      const branchRows = branchList.map((b) => [
        b.name,
        b.lastCommitDate || "-",
        commitFrequencyByBranch[b.name] != null
          ? commitFrequencyByBranch[b.name]
          : "-",
      ]);
      console.log(
        renderTable(
          branchRows,
          [
            { header: "Branch", width: 22 },
            { header: "Last Date", width: 11 },
            { header: "Commits", width: 8, align: "right" },
          ],
          colorEnabled
        )
      );
      console.log();
      printSectionHeader("Branch Stats", colorEnabled);
      const branchStatsRows = branchStats.map((bs) => [
        bs.branch,
        bs.commits,
        bs.merges,
        bs.authors,
      ]);
      console.log(
        renderTable(
          branchStatsRows,
          [
            { header: "Branch", width: 22 },
            { header: "Commits", width: 8, align: "right" },
            { header: "Merges", width: 7, align: "right" },
            { header: "Authors", width: 7, align: "right" },
          ],
          colorEnabled
        )
      );
      console.log();
    } else {
      // Unified table combines overview + stats
      printSectionHeader("Branches", colorEnabled);
      // Build a lookup for stats by branch name
      const statsMap = new Map();
      branchStats.forEach((s) => statsMap.set(s.branch, s));
      const unifiedRows = branchList.map((b) => {
        const stats = statsMap.get(b.name) || {};
        return [
          b.name,
          b.lastCommitDate || "-",
          commitFrequencyByBranch[b.name] != null
            ? commitFrequencyByBranch[b.name]
            : stats.commits != null
            ? stats.commits
            : "-",
          stats.merges != null ? stats.merges : "-",
          stats.authors != null ? stats.authors : "-",
        ];
      });
      console.log(
        renderTable(
          unifiedRows,
          [
            { header: "Branch", width: 22 },
            { header: "Last Date", width: 11 },
            { header: "Commits", width: 8, align: "right" },
            { header: "Merges", width: 7, align: "right" },
            { header: "Authors", width: 7, align: "right" },
          ],
          colorEnabled
        )
      );
      console.log();
    }
  }

  if (dashboardFlags.showFiles) {
    // File stats
    printSectionHeader(
      `File Stats (Top ${dashboardFlags.topFilesLimit})`,
      colorEnabled
    );
    const fileRows = fileStats.map((f) => [
      f.path,
      f.changes,
      f.additions,
      f.deletions,
    ]);
    console.log(
      renderTable(
        fileRows,
        [
          { header: "File", width: 40 },
          { header: "Changes", width: 8, align: "right" },
          { header: "Add", width: 6, align: "right" },
          { header: "Del", width: 6, align: "right" },
        ],
        colorEnabled
      )
    );
    console.log();

    // Directory stats
    printSectionHeader("Directory Stats", colorEnabled);
    const dirRows = directoryStats.map((d) => [
      d.directory,
      d.changes,
      d.additions,
      d.deletions,
    ]);
    console.log(
      renderTable(
        dirRows,
        [
          { header: "Directory", width: 20 },
          { header: "Changes", width: 8, align: "right" },
          { header: "Add", width: 6, align: "right" },
          { header: "Del", width: 6, align: "right" },
        ],
        colorEnabled
      )
    );
    console.log();
  }

  console.log(
    colorize(
      `Updated: ${new Date().toLocaleString()}`,
      ANSI_CODES.dim,
      colorEnabled
    )
  );
}

// ------------------------------ Entrypoint -------------------------------
function main() {
  const dashboardFlags = parseDashboardFlags(process.argv.slice(2));
  const gitVizData = runGitVizAggregate(dashboardFlags);
  renderDashboard(dashboardFlags, gitVizData);
}

main();
