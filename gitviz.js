#!/usr/bin/env node
/**
 * Git Log Visualizer (CLI) — Node.js
 * Shows: Commit frequency, contributors, branches summary
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

// ========= Helpers =========
const COLORS = {
  reset: "\x1b[0m", bold: "\x1b[1m", blue: "\x1b[34m",
  cyan: "\x1b[36m", yellow: "\x1b[33m", dim: "\x1b[2m"
};
const color = (s, c) => (process.stdout.isTTY ? c + s + COLORS.reset : s);
const padLeft = (s, n) => ((" ".repeat(n) + s).slice(-n));
const padRight = (s, n) => ((s + " ".repeat(n)).slice(0, n));
const fmtDate = d => d.toISOString().slice(0, 10);
const today = () => fmtDate(new Date());

const runGit = (args, cwd = ".") => {
  try { return execFileSync("git", args, { cwd, encoding: "utf8" }); }
  catch (e) { console.error("Git error:", e.stderr || e.message); process.exit(1); }
};

// ========= Args =========
function parseArgs(argv) {
  const out = { repo: ".", days: 30, all: false, author: null, width: 40, top: 10, limitBranches: 15,
    noBranches: false, noContrib: false, noGraph: false, help: false };
  const map = { "--repo":"repo","--days":"days","--author":"author","--width":"width","--top":"top","--limit-branches":"limitBranches" };
  for (let i=0;i<argv.length;i++) {
    const k = argv[i], v = argv[i+1];
    if (map[k]) out[map[k]] = isNaN(v) ? v : +v, i++;
    else if (["--all","--no-branches","--no-contrib","--no-graph"].includes(k)) out[k.slice(2)] = true;
    else if (["-h","--help"].includes(k)) out.help = true;
  }
  return out;
}

// ========= Git Data =========
const ensureGitRepo = cwd => runGit(["rev-parse","--is-inside-work-tree"], cwd);

function parseGitLog(days, all, author, cwd) {
  const fmt = "%h|%an|%ad";
  const args = ["log","--date=short",`--pretty=format:${fmt}`];
  if (all) args.splice(1,0,"--all");
  if (author) args.push(`--author=${author}`);
  if (days>0){ const d=new Date(); d.setDate(d.getDate()-(days-1)); args.push(`--since=${fmtDate(d)}`); }
  return runGit(args,cwd).trim().split("\n").map(l=>{
    const [h,a,d]=l.split("|"); return {hash:h,author:a,date:d};
  });
}

function getRepoAge(repo) {
  const first = runGit(["log","--date=short","--pretty=%ad","--reverse"], repo).split("\n")[0];
  return first ? Math.ceil((Date.parse(today())-Date.parse(first))/86400000)+1 : 0;
}

function branchesSummary(limit,cwd){
  const fmt="%(if)%(HEAD)%(then)*%(else) %(end)%(refname:short)|%(committerdate:short)|%(objectname:short)";
  return runGit(["for-each-ref","--sort=-committerdate",`--format=${fmt}`,"refs/heads/"],cwd)
    .trim().split("\n").slice(0,limit).map(l=>{
      const current=l.startsWith("*"), [name,date,tip]=l.slice(1).split("|");
      const count=+runGit(["rev-list","--count",name.trim()],cwd);
      return {name:name.trim(),date,tip,count,current};
    });
}

// ========= Printers =========
function header(s){ console.log("\n"+color(s,COLORS.bold)); console.log(color("─".repeat(s.length),COLORS.blue)); }

function printCommitFrequency(commits, days){
  header(`Commit Frequency (last ${days} days)`);
  const counts={}; commits.forEach(c=>counts[c.date]=(counts[c.date]||0)+1);
  const start=new Date(); start.setDate(start.getDate()-(days-1));
  console.log("┌────────────┬───────────┐\n│ Date       │ Commits   │\n├────────────┼───────────┤");
  for(let i=0;i<days;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const s=fmtDate(d);
    console.log(`│ ${s} │ ${padLeft(counts[s]||0,9)} │`); }
  console.log("└────────────┴───────────┘");
}

function printContributors(commits, top){
  header("Top Contributors");
  const counts={}; commits.forEach(c=>counts[c.author]=(counts[c.author]||0)+1);
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  if (!total) return console.log("No commits found.");
  console.log(`Total commits: ${total}`);
  console.log("┌────┬────────────────────────────┬────────┬────────┐");
  console.log("│ #  │ Author                     │ Commits│ Share  │");
  console.log("├────┼────────────────────────────┼────────┼────────┤");
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,top).forEach(([a,n],i)=>{
    const share=((n/total)*100).toFixed(1)+"%";
    console.log(`│ ${padLeft(i+1,2)} │ ${padRight(a,28)} │ ${padLeft(n,6)} │ ${padLeft(share,6)} │`);
  });
  console.log("└────┴────────────────────────────┴────────┴────────┘");
}

function printBranches(branches){
  header("Branches (local)");
  if (!branches.length) return console.log("No branches found.");
  console.log("┌────┬────────────────────────────┬────────┬────────────┬────────┐");
  console.log("│ *  │ Branch                     │ Commits│ Last Commit│ Tip    │");
  console.log("├────┼────────────────────────────┼────────┼────────────┼────────┤");
  branches.forEach(b=>{
    console.log(`│ ${b.current?"*":" "}  │ ${padRight(b.name,28)} │ ${padLeft(b.count,6)} │ ${padRight(b.date,10)} │ ${padRight(b.tip,6)} │`);
  });
  console.log("└────┴────────────────────────────┴────────┴────────────┴────────┘");
}

// ========= Main =========
(function main(){
  const args=parseArgs(process.argv.slice(2));
  if (args.help) return console.log("Usage: node gitviz.js [options]");
  if (!fs.existsSync(args.repo)) return console.error("Repo not found"),process.exit(1);
  ensureGitRepo(args.repo);

  const age=getRepoAge(args.repo);
  if(args.days>age) args.days=age;
  const commits=parseGitLog(args.days,args.all,args.author,args.repo);

  console.log(color("Git Log Visualizer (CLI)",COLORS.bold));
  console.log(color(`Repo: ${args.repo}`,COLORS.cyan));
  console.log(color(`Repo Age: ${age} days\nTime Window: ${args.days} days${args.author?`, Author: ${args.author}`:""}`,COLORS.dim));

  if(!args.noGraph) printCommitFrequency(commits,args.days);
  if(!args.noContrib) printContributors(commits,args.top);
  if(!args.noBranches) printBranches(branchesSummary(args.limitBranches,args.repo));
})();
