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

// TODO: Use this config to fix formatting, align right coloums to end the right and expand the fist col.
const CONFIG = {
    CONTRIBUTORS_LIMIT: 3,
    FILES_LIMIT: 3,
    DIRECTORY_LIMIT: 3,
};

let BASE_CMD = `node gitviz-cli.js`;

// ------------------------- gitviz-cli MANAGEMENT ------------------------
function buildGitVizArgs() {
    // Command Line Args
    let argsStr = "";
    process.argv.slice(2).map((a) => {
        argsStr += ` ${a}`;
    });

    // Defaults flags, override by Cmd Line args if specified
    const flags = ["--meta", "--total-commits", "--top", "--contributor-stats", "--file-stats", "--directory-stats", "--branches", "--branch-stats", "--commit-frequency"].filter((flag) => !process.argv.includes(flag)).join(" ");
    return `${argsStr} ${flags}`;
}
function runGitVizCmdWithFlags(flagsStr) {
    const command = `${BASE_CMD} ${flagsStr} --json`;
    // console.warn(command);

    try {
        const rawOutput = execSync(command, { encoding: "utf8" });
        // In the case of wrong flags, the gitviz-cli.js outputs help text
        if (rawOutput.startsWith("GitViz")) {
            console.warn(`The provided command/flags aren't valid!, see: ${command}`);
            process.exit(1);
        }
        return JSON.parse(rawOutput);
    } catch (error) {
        console.error(`Failed to execute gitviz CLI. \n Command: ${command}`);
        console.error(error.stdout || error.message);
        process.exit(1);
    }
}

// ---------------- Custom Parsing (for quick fix only) ----------------------
function aggregateCommitFrequencies(dailyFrequencyObj) {
    const weekly = {};
    const monthly = {};

    Object.entries(dailyFrequencyObj).forEach(([dateStr, commitCount]) => {
        // Monthly: 2025-08-21 -> 2025-08 (same as CLI)
        const monthKey = dateStr.slice(0, 7);
        monthly[monthKey] = (monthly[monthKey] || 0) + commitCount;

        // Weekly: Use CLI's exact logic
        const weekKey = getCliCompatibleWeekKey(dateStr);
        weekly[weekKey] = (weekly[weekKey] || 0) + commitCount;
    });

    // Sort keys chronologically (same as CLI does)
    const sortedWeekly = {};
    Object.keys(weekly).sort().forEach(k => sortedWeekly[k] = weekly[k]);
    
    const sortedMonthly = {};
    Object.keys(monthly).sort().forEach(k => sortedMonthly[k] = monthly[k]);

    return { 
        daily: dailyFrequencyObj, 
        weekly: sortedWeekly, 
        monthly: sortedMonthly 
    };
}

function getCliCompatibleWeekKey(dateStr) {
    const d = new Date(dateStr + "T00:00:00Z");
    const temp = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const dayNum = Math.floor((d - temp) / 86400000) + 1;
    const week = Math.ceil(dayNum / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
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
    red: "\x1b[31m",
    pink: "\x1b[38;2;255;105;180m",
};

function colorize(text, colorCode, enabled = true) {
    colorCode = colorCode.toLowerCase();
    if (!(colorCode in ANSI_CODES)) {
        throw new Error(`Unknown color code: ${colorCode}`);
    }
    return enabled ? `${ANSI_CODES[colorCode]}${text}${ANSI_CODES.reset}` : text;
}

function computeContributorPercentages(contributors) {
    const totalCommits = contributors.reduce((sum, c) => sum + (c.commits || 0), 0) || 0;
    return contributors.map((c) => ({
        ...c,
        percent: totalCommits ? ((c.commits / totalCommits) * 100).toFixed(1) : "0.0",
    }));
}

function truncateText(value, width) {
    const display = stripAnsi(value);
    return display.length > width ? display.slice(0, width - 1) + "…" : value;
}
function padCell(value, width, align = "left") {
    const raw = truncateText(value, width);
    const padding = width - stripAnsi(raw).length;

    if (align === "right") {
        return " ".repeat(Math.max(0, padding)) + raw;
    } else {
        return raw + " ".repeat(Math.max(0, padding));
    }
}

function renderTable(rowMatrix, columnDefinitions, colorEnabled = true) {
    if (!rowMatrix.length) return "(no data)";
    const headerRow = columnDefinitions.map((col) => colorize(padCell(col.header, col.width, col.align), "bold")).join(" ");
    const dividerRow = columnDefinitions.map((col) => "─".repeat(Math.max(0, col.width))).join(" ");
    const bodyRows = rowMatrix
        .map((r) => r
                .map((cell, idx) => {
                    const def = columnDefinitions[idx];
                    return padCell(cell == null ? "" : cell, def.width, def.align);
                })
                .join(" ")
        )
        .join("\n");
    return headerRow + "\n" + dividerRow + "\n" + bodyRows;
}
function stripAnsi(str) {
    // Remove ANSI escape sequences to get true display width
    return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

function calcHighestWidth(obj, objSelector, min = 0) {
    const values = obj.map((item) => item[objSelector]).filter(Boolean);
    return values.length > 0 ? Math.max(...values.map((v) => stripAnsi(v).length), min) : min;
}
function getTerminalWidth() {
    return process.stdout.columns || 100;
}
function horizontalRule({char="─", minWidth=0, maxWidth=300} = {}) {
	return char.repeat(Math.min(Math.max(getTerminalWidth(), minWidth), maxWidth));
}
function centerText({text, minWidth=0, maxWidth=300} = {}) {
    const width = Math.min(Math.max(getTerminalWidth(), minWidth), maxWidth);
    if (text.length >= width) return text.slice(0, width);
    const padSize = width - text.length;
    const left = Math.floor(padSize / 2);
    const right = padSize - left;
    return " ".repeat(left) + text + " ".repeat(right);
}
function printSectionHeader(title, color="cyan", minWidth=0, maxWidth=100, insertNewLineBefore=true, insertNewLineAfter=false) {
    insertNewLineBefore ? console.log() : null;
    console.log(colorize(colorize(centerText({text: ` ${title} `, maxWidth}), color), "bold"));
    console.log(horizontalRule({maxWidth}));
	insertNewLineAfter ? console.log() : null;
}

// ----------------------------- Sections --------------------------------
function showMeta(metaObj) {
    console.log(`
${colorize("Repo:", "gray")} ${colorize(metaObj.repo === "." ? ". (current directory)" : metaObj.repo, "cyan")}
${colorize("Time Range:", "gray")} ${colorize(metaObj.since, "yellow")} to ${colorize(metaObj.until, "yellow")}, ${colorize(metaObj.rangeDays, "magenta")} ${colorize("days", "gray")}
${colorize("First commit was created at", "gray")} ${colorize(metaObj.firstCommitDate, "green")}, ${colorize(metaObj.repoAgeDays, "magenta")} ${colorize("days ago", "gray")}
${colorize("This dashboard is generated at", "gray")} ${colorize(metaObj.generated, "pink")}
`);
}
function showContributors(contributorsObj, contributorsStatsObj) {
    // contributorsStatsObj can directly be used, the difference is that
    // it also has additions and deletions attributes,
    // I may changed it, so similiar, may remove any one? see later!
    const combinedObjArr = contributorsObj.map((obj, i) => ({
        ...obj,
        ...contributorsStatsObj[i],
    })).sort((a, b) => b.commits - a.commits).slice(0, CONFIG.CONTRIBUTORS_LIMIT);

    const contributorRows = computeContributorPercentages(combinedObjArr).map((c) => [colorize(`${c.name} <${c.email}>`, "blue"), colorize(c.commits, "yellow"), colorize(c.percent + "%", "magenta"), colorize(c.additions, "green"), colorize(c.deletions, "red")]);

    console.log(
        renderTable(contributorRows, [
            {
                header: colorize("Contributor", "blue"),
                width: calcHighestWidth(contributorRows, 0),
                align: "left",
            },
            {
                header: colorize("Commits", "yellow"),
                width: calcHighestWidth(contributorRows, 1, 7),
                align: "right",
            },
            { header: colorize("%", "magenta"), width: 5, align: "right" },
            {
                header: colorize("Additions", "green"),
                width: calcHighestWidth(contributorRows, 3, 9),
                align: "right",
            },
            {
                header: colorize("Deletions", "red"),
                width: calcHighestWidth(contributorRows, 4, 9),
                align: "right",
            },
        ])
    );
}
function buildSparkline(dailyMap, maxPoints = 30) {
    const dateKeys = Object.keys(dailyMap || {}).sort();
    if (!dateKeys.length) return "(no commit frequency)";
    const sliceKeys = dateKeys.slice(-maxPoints);
    const values = sliceKeys.map((k) => dailyMap[k]);
    const maxValue = Math.max(...values);
    if (maxValue === 0) return "(all zero)";
    const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
    return values.map((v) => blocks[Math.round((v / maxValue) * (blocks.length - 1))]).join("") + ` max:${maxValue}`;
}
function showCommitFrequency(commitFrequencyObj) {
    console.log(buildSparkline(commitFrequencyObj));
}
function showFileStats(fileObj) {
    const sortedFileObj = fileObj.sort((a, b) => b.additions - a.additions).slice(0, CONFIG.FILES_LIMIT);

    const fileRows = sortedFileObj.map((file) => [colorize(file.path, "cyan"), colorize(file.changes, "gray"), colorize(file.additions, "green"), colorize(file.deletions, "red")]);

    console.log(
        renderTable(fileRows, [
            {
                header: colorize("File Path", "cyan"),
                width: calcHighestWidth(fileRows, 0, 9),
                align: "left",
            },
            {
                header: colorize("Changes", "gray"),
                width: calcHighestWidth(fileRows, 1, 7),
                align: "right",
            },
            {
                header: colorize("Additions", "green"),
                width: calcHighestWidth(fileRows, 2, 9),
                align: "right",
            },
            {
                header: colorize("Deletions", "red"),
                width: calcHighestWidth(fileRows, 3, 9),
                align: "right",
            },
        ])
    );
}
function showDirectoryStats(directoryObj) {
    const sortedDirectoryObj = directoryObj.sort((a, b) => b.additions - a.additions).slice(0, CONFIG.DIRECTORY_LIMIT);

    const directoryRows = sortedDirectoryObj.map((directory) => [colorize(directory.directory, "magenta"), colorize(directory.changes, "gray"), colorize(directory.additions, "green"), colorize(directory.deletions, "red")]);

    console.log(
        renderTable(directoryRows, [
            {
                header: colorize("Directory", "magenta"),
                width: calcHighestWidth(directoryRows, 0, 9),
                align: "left",
            },
            {
                header: colorize("Changes", "gray"),
                width: calcHighestWidth(directoryRows, 1, 7),
                align: "right",
            },
            {
                header: colorize("Additions", "green"),
                width: calcHighestWidth(directoryRows, 2, 9),
                align: "right",
            },
            {
                header: colorize("Deletions", "red"),
                width: calcHighestWidth(directoryRows, 3, 9),
                align: "right",
            },
        ])
    );
}
function showBranches(branchObj, branchStatsObj) {
    const combinedObjArr = branchObj.map((obj, i) => ({
        ...obj,
        ...branchStatsObj[i],
    }));

    const branchesRows = combinedObjArr.map((branchStat) => [
        colorize(branchStat.branch, "pink"),
        colorize(branchStat.tip, "gray"),
        colorize(branchStat.commits, "yellow"),
        colorize(branchStat.merges, "green"),
        colorize(`${truncateText(branchStat.lastAuthor, 12)}/${branchStat.lastCommitDate}`, "cyan"),
        colorize(branchStat.authors, "magenta"),
        // branchStat.lastAuthorEmail,
        // branchStat.authorList,
    ]);

    console.log(
        renderTable(branchesRows, [
            {
                header: colorize("Branch", "pink"),
                width: calcHighestWidth(branchesRows, 0, 11),
                align: "left",
            },
            { header: colorize("Tip Hash", "gray"), width: 8 },
            {
                header: colorize("Commits", "yellow"),
                width: calcHighestWidth(branchesRows, 2, 8),
                align: "right",
            },
            {
                header: colorize("Merges", "green"),
                width: calcHighestWidth(branchesRows, 3, 6),
                align: "right",
            },
            {
                header: colorize("Last Commit Author/Date", "cyan"),
                width: calcHighestWidth(branchesRows, 4, 23),
            },
            {
                header: colorize("Authors", "magenta"),
                width: calcHighestWidth(branchesRows, 5, 7),
                align: "right",
            },
        ])
    );
}
function debugColor() {
    for (let color in ANSI_CODES) {
        console.log(colorize(`GITVIZ ${color}`, color));
    }
}
function main() {
    // debugColor();

    const gitvizArgs = buildGitVizArgs();
    const gitvizData = runGitVizCmdWithFlags(gitvizArgs);

	printSectionHeader("GitViz CLI Dashboard");
    showMeta(gitvizData.meta);
	
	printSectionHeader("Commit Frequency");
    aggregatedCommitFrequencyData = aggregateCommitFrequencies(gitvizData.commitFrequency);
    if (aggregatedCommitFrequencyData.daily) { 
		console.log(colorize("Daily:", "yellow"))
		showCommitFrequency(aggregatedCommitFrequencyData.daily); 
	}
    if (aggregatedCommitFrequencyData.weekly) { 
		console.log(colorize("Weekly:", "green"))
		showCommitFrequency(aggregatedCommitFrequencyData.weekly); 
	}
    if (aggregatedCommitFrequencyData.monthly) { 
		console.log(colorize("Monthly:", "blue"))
		showCommitFrequency(aggregatedCommitFrequencyData.monthly); 
	}

	printSectionHeader("Branches (local)");
	showBranches(gitvizData.branches, gitvizData.branchStats);
	
	printSectionHeader(`Contributors (top ${CONFIG.CONTRIBUTORS_LIMIT})`);
    showContributors(gitvizData.contributors, gitvizData.contributorStats);
	
	printSectionHeader(`Files Stats (top ${CONFIG.FILES_LIMIT})`);
    showFileStats(gitvizData.fileStats);
	
	printSectionHeader(`Directory Stats (top ${CONFIG.DIRECTORY_LIMIT})`);
    showDirectoryStats(gitvizData.directoryStats);

	console.log("\nGitHub: https://github.com/AdilAhmedShekhani/GitViz")
}
main();
process.exit(1)```
--contributors	List authors with commit counts.
--top N	Top N contributors (implies --contributors).
--contributor-stats	Commits + additions + deletions per author.
--commit-frequency[=g]	Commits grouped by g = daily (default), weekly, monthly.
--commit-frequency-by-author	Per-author daily commit counts.
--commit-frequency-by-branch	Commit counts per branch (respects date filters).
--branches	Branch basic info (name, tip, last commit date, last author).
--branch-stats	Commits, merges, unique author count + list per branch.
--total-commits	Total commits in range.
--average-commits-per-day	Average commits per day in range.
--commit-distribution	Date → commit count map (daily).
--file-stats	Per file churn: changes, additions, deletions.
--directory-stats	Aggregated churn per directory.
--meta	Add meta: repo, since, until, repoAgeDays, firstCommitDate, rangeDays, generated.
--full-history	Use entire repo history (disables default window if no explicit range).
--format json / --json	Output JSON instead of text.
```;
