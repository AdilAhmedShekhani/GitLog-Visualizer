const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const TMP_DIR = path.join(__dirname, "tmp-repos");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

// Utility: Run git commands safely
function runGitCommand(repoUrl, gitArgs, cb) {
  const repoName = path.basename(repoUrl, ".git");
  const repoPath = path.join(TMP_DIR, repoName);

  console.log("Repo path:", repoPath);
  console.log("Git args:", gitArgs);

  if (!fs.existsSync(repoPath)) {
    // Clone repo first
    const cloneCmd = `git clone ${repoUrl} ${repoName}`;
    exec(cloneCmd, { cwd: TMP_DIR }, (err) => {
      if (err) return cb(`Clone failed: ${err.message}`);
      runGitCommand(repoUrl, gitArgs, cb); // run command after clone
    });
  } else {
    // Repo exists, fetch latest
    exec(`git fetch --all`, { cwd: repoPath }, (fetchErr) => {
      if (fetchErr) console.error("Fetch warning:", fetchErr.message);
      exec(`git ${gitArgs}`, { cwd: repoPath }, (err, stdout, stderr) => {
        if (err) return cb(stderr || err.message);
        cb(null, stdout.trim());
      });
    });
  }
}

// API: Get commits
app.get("/api/commits", (req, res) => {
  const { repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: "repoUrl query param required" });

  runGitCommand(repoUrl, 'log --pretty=format:"%h|%an|%s|%ad" --date=short', (err, out) => {
    if (err) return res.status(500).json({ error: err });
    const commits = out.split("\n").map(line => {
      const [hash, author, message, date] = line.split("|");
      return { hash, author, message, date };
    });
    res.json(commits);
  });
});

// API: Get contributors
app.get("/api/contributors", (req, res) => {
  const { repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: "repoUrl query param required" });

  runGitCommand(repoUrl, "shortlog -sne", (err, out) => {
    if (err) return res.status(500).json({ error: err });
    const contributors = out.split("\n").map(line => {
      const match = line.trim().match(/^(\d+)\s+(.*)\s+<(.*)>$/);
      if (!match) return null;
      return { commits: parseInt(match[1]), name: match[2], email: match[3] };
    }).filter(Boolean);
    res.json(contributors);
  });
});

// API: Get file stats
app.get("/api/file-stats", (req, res) => {
  const { repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: "repoUrl query param required" });

  runGitCommand(repoUrl, "ls-files", (err, out) => {
    if (err) return res.status(500).json({ error: err });
    const files = out.split("\n").map(f => ({ path: f }));
    res.json(files);
  });
});

app.listen(5000, () => {
  console.log("GitViz API running at http://localhost:5000");
});
