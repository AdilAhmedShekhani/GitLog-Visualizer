const { execSync } = require("child_process");

function runGitviz(flags) {
  return JSON.parse(execSync(`node gitviz-cli ${flags} --json`).toString());
}

const topContribs = runGitviz("--top 5 --contributors");
const commits = runGitviz("--commit-frequency=weekly");
const branches = runGitviz("--branches");
const dirs = runGitviz("--directory-stats");

function showMeta(){
    const meta = runGitviz("--meta").meta;
    console.log(`Repo: ${meta.repo === "." ? `. (current directory)` : `${meta.repo}`}`);
    console.log(`Time Range from ${meta.since} to ${meta.until}`);
    console.log(`Repo Age: ${meta.repoAgeDays} days \n`)
    
}
// console.log("\n👥 Top Contributors");
// topContribs.forEach((c, i) => {
//   console.log(`${i + 1}. ${c.author}  ${"█".repeat(c.commits / 10)} ${c.commits}`);
// });

function main(){
    console.log(`=== GitViz CLI Dashboard ===`)
    showMeta();

    console.log(`\n`)
}
main()
