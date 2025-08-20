// server/index.js
const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// ---------- helpers ----------
const fmtDate = (d) => d.toISOString().slice(0, 10);
function sinceDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return fmtDate(d);
}

function runGit(args, repo) {
    return new Promise((resolve, reject) => {
        const fullArgs = ["-C", repo, ...args];
        execFile("git", fullArgs, { encoding: "utf8" }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });
}

async function ensureRepo(repo) {
    const abs = path.resolve(repo);
    try {
        const out = await runGit(["rev-parse", "--is-inside-work-tree"], abs);
        if (!out.trim().includes("true")) throw new Error("Not a git repo");
        return abs;
    } catch (_) {
        throw new Error(`Not a valid git repo: ${abs}`);
    }
}

// ---------- routes ----------
app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * GET /api/commit-frequency?repo=.<path>&days=7
 * returns: { repo, days, series: [{date, commits}, ...] }
 */
app.get("/api/commit-frequency", async (req, res) => {
    const repo = req.query.repo || ".";
    const days = Math.max(1, Math.min(90, parseInt(req.query.days || "7", 10)));
    try {
        const cwd = await ensureRepo(repo);
        const since = sinceDate(days);

        // pull commit dates
        const out = await runGit(
            ["log", "--date=short", "--pretty=%ad", `--since=${since}`],
            cwd
        );
        const lines = out.trim() ? out.trim().split("\n") : [];
        const counts = {};
        for (const d of lines) counts[d] = (counts[d] || 0) + 1;

        // build complete series with zeros
        const series = [];
        const start = new Date(since);
        for (let i = 0; i < days; i++) {
            const dt = new Date(start);
            dt.setDate(start.getDate() + i);
            const key = fmtDate(dt);
            series.push({ date: key, commits: counts[key] || 0 });
        }
        res.json({ repo: cwd, days, series });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ---------- start ----------
app.listen(PORT, () =>
    console.log(`API listening on http://localhost:${PORT}`)
);
