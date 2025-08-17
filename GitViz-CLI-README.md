# GitViz CLI

Minimal Git inspector. Ask for only the data blocks you want (contributors, branches, file/directory change activity, frequencies, etc.).

Default output is plain text: one fact per line, easy to scan or pipe into `findstr` / `grep`. Add `--format json` (or the shorthand `--json`) when another tool needs to parse it. Add `--meta` if you also want repo + time range info.

> Code churn = how much code changes over a period (additions + deletions, sometimes counted as “changes” or edits)

---

## 1. What It Helps You Answer

- Who contributes (and how much)?
- How many commits per day / week / month?
- Which branches are active? How many merges? Unique authors per branch?
- Which files / directories churn the most?
- Line additions / deletions per contributor?

You choose flags; it prints only those sections. No colors. No fluff.

---

## 2. Argument Forms (Flexible)

- Boolean flags stand alone: `--all`, `--contributors`, etc.

Every value‑taking flag accepts all of these forms:

- Space: `--format json`
- Equals: `--format=json`
- Brackets: `--format[json]`
- (Some flags also allow being followed by a value as a next token.)
  > Flags mix-up is allowed

Time / range flags:

- `--since YYYY-MM-DD`
- `--until YYYY-MM-DD`
- `--days N` (fallback if explicit since/until not set; default = last 30 days)

Scope / filter:

- `--repo <path>` (default `.`)
- `--all` (consider all refs, not only current branch)
- `--author <pattern>` (git author regex)

Output :

- Plain text (default)
- JSON format.
- `--format json` (default text)
- `--json` (alias for `--format json`)

- `--meta` include meta (repo, since, until, repoAgeDays, generated) —
  - In text: meta lines are printed first, then a blank line, then requested sections.
  - In JSON: `meta` becomes a top‑level object.

Help:

- `-h` or `--help`

---

## 3. Output Formats

### Plain Text (default)

Rules:

- One logical fact per line: `key: value`.
- Arrays of objects become readable blocks separated by one blank line.
- Simple object maps (like date->count) print as direct `YYYY-MM-DD: N` lines.
- `--meta` (if present) block always on top.

Flag:

- No Flag required

Example: Requested Meta.

Command: `node gitviz-cli --meta`

```
repo: .
since: 2025-07-19
until: 2025-08-17
repoAgeDays: 5
generated: 2025-08-17T02:12:25.405Z
```

### JSON

- Only includes the sections you explicitly requested (plus `meta` when `--meta`).
- Perfect for Parsing.

Flag:

- `format=json`, etc.
- `--json` alias.

Example: Requested Meta in JSON.

Command: `node gitviz-cli --meta --json`

```json
{
  "meta": {
    "repo": ".",
    "since": "2025-07-19",
    "until": "2025-08-17",
    "repoAgeDays": 5,
    "generated": "2025-08-17T02:13:25.741Z"
  }
}
```

---

## 4. Data Flags (Sections)

> This all flags can be provided in different ways, see section 2, Argument Forms

| Flag                           | Description                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--contributors`               | List authors with commit counts.                                                                                                            |
| `--top N`                      | Top N contributors, default is 10 (implies `--contributors`).                                                                               |
| `--contributor-stats`          | Commits + additions + deletions per author.                                                                                                 |
| `--commit-frequency[=g]`       | Commits grouped by granularity `g` = `daily` (default), `weekly`, `monthly`.                                                                |
| `--commit-frequency-by-author` | Per-author daily commit counts.                                                                                                             |
| `--commit-frequency-by-branch` | Commit counts per branch (respects date filters).                                                                                           |
| `--branches`                   | Branch name, tip (short hash), last commit date, last author.                                                                               |
| `--branch-stats`               | Commits, merges, unique author count + author list per branch.                                                                              |
| `--total-commits`              | Total commits in range.                                                                                                                     |
| `--average-commits-per-day`    | Average commits per day across range.                                                                                                       |
| `--file-stats`                 | Per file: changes, additions, deletions.                                                                                                    |
| `--directory-stats`            | Aggregated stats per directory.                                                                                                             |
| `--meta`                       | Add meta: repo path, since/until, repo age (days), generated (ISO‑8601 UTC timestamp: year, month, day, hour, minute, second, millisecond). |
| `--format json` / `--json`     | Output JSON instead of plain text.                                                                                                          |

Time & scope (modify what data feeds each section): `--since`, `--until`, `--days`, `--repo`, `--all`, `--author`.

If you request nothing, help is shown.

---

## 5. Samples

### Contributors

```
node gitviz-cli.js --contributors
```

```
name: Alice
email: alice@example.com
commits: 12

name: Bob
email: bob@example.com
commits: 4
```

### Top N Contributors

```
node gitviz-cli.js --top 1
```

```
name: Alice
email: alice@example.com
commits: 12
```

### Contributor Line Stats

```
node gitviz-cli.js --contributor-stats
```

```
name: Alice
email: alice@example.com
commits: 12
additions: 340
deletions: 120

name: Bob
email: bob@example.com
commits: 4
additions: 50
deletions: 10
```

### Commit Frequency (Daily)

```
node gitviz-cli.js --commit-frequency daily
```

```
2025-08-17: 3
2025-08-16: 3
2025-08-15: 2
2025-08-14: 1
2025-08-13: 1
```

Weekly / monthly just change the key labels (e.g. `2025-W34`, `2025-08`).

### Commit Frequency By Author

```
node gitviz-cli.js --commit-frequency-by-author --json
```

Plain text prints author blocks; JSON version for clarity:

```json
{
  "commitFrequencyByAuthor": {
    "Alice": { "2025-08-16": 2, "2025-08-17": 1 },
    "Bob": { "2025-08-16": 1 }
  }
}
```

### Branches

```
node gitviz-cli.js --branches
```

```
name: main
tip: a1b2c3d
lastCommitDate: 2025-08-17
lastAuthor: Alice
lastAuthorEmail: alice@example.com

name: dev
tip: d4e5f6a
lastCommitDate: 2025-08-16
lastAuthor: Bob
lastAuthorEmail: bob@example.com
```

### Branch Stats

```
node gitviz-cli.js --branch-stats
```

```
branch: main
commits: 14
merges: 3
authors: 2
author: Alice <alice@example.com>
author: Bob <bob@example.com>

branch: dev
commits: 6
merges: 1
authors: 2
author: Bob <bob@example.com>
author: Alice <alice@example.com>
```

### File Stats

```
node gitviz-cli.js --file-stats
```

```
path: gitviz.js    
changes: 4
additions: 540     
deletions: 55      

path: gitviz-cli.js
changes: 3
additions: 826     
deletions: 38

path: README.md
changes: 2
additions: 36
deletions: 4

path: package.json
changes: 1
additions: 12
deletions: 0
```

### Directory Stats

```
node gitviz-cli.js --directory-stats
```

```
directory: .   
changes: 10    
additions: 1414
deletions: 97 
```

### Totals / Averages / Distribution

```
node gitviz-cli.js  --total-commits --average-commits-per-day --since 2025-08-01 --until 2025-08-17
```

```
totalCommits: 10
averageCommitsPerDay: 0.59
```

---

## 6. Combining Flags

Contributors + line stats:

```
node gitviz-cli.js --contributors --contributor-stats
```

Frequency + totals + average over a bound range:

```
node gitviz-cli.js --commit-frequency=weekly --total-commits --average-commits-per-day --since 2025-08-01 --until 2025-08-31
```

File + directory churn since a date:

```
node gitviz-cli.js --file-stats --directory-stats --since 2025-08-10
```

Branch health snapshot:

```
node gitviz-cli.js --branches --branch-stats --commit-frequency-by-branch
```

JSON with meta (shorthand alias):

```
node gitviz-cli.js --contributors --json --meta
```

---

## 7. Full Example (Many Sections at Once)

Goal: last 14 days, all refs, only Alice, frequency & churn, as JSON with meta.

```
node gitviz-cli.js \
  --since 2025-08-04 \
  --until 2025-08-17 \
  --all \
  --commit-frequency-by-author "Name/Regex" \
  --commit-frequency=daily \
  --total-commits \
  --average-commits-per-day \
  --file-stats \
  --directory-stats \
  --branches \
  --branch-stats \
  --json \
  --meta
```
Above command doesn't work? try below command. Also make sure to tune this command according to you!

```
node gitviz-cli.js  --since 2025-08-14  --until 2025-08-17  --all --commit-frequency-by-author Name/Regex"  --commit-frequency=daily  --total-commits  --average-commits-per-day  --file-stats  --directory-stats  --branches  --branch-stats  --json   --meta
```

```
{
  "commitFrequency": {
    "2025-08-17": 3,
    "2025-08-16": 3,
    "2025-08-15": 5,
    "2025-08-14": 1
  },
  "commitFrequencyByAuthor": {
    "Saadullah Khan": {
      "2025-08-17": 3,
      "2025-08-16": 1,
      "2025-08-15": 5,
      "2025-08-14": 1
    },
    "AdilAhmedShekhani": {
      "2025-08-16": 2
    }
  },
  "branches": [
    {
      "name": "main",
      "tip": "47a0bc3",
      "lastCommitDate": "2025-08-16",
      "lastAuthor": "AdilAhmedShekhani",
      "lastAuthorEmail": "alice@example.com"
    },
    {
      "name": "refactor",
      "tip": "77b27ac",
      "lastCommitDate": "2025-08-17",
      "lastAuthor": "Saadullah Khan",
      "lastAuthorEmail": "bob@example.com"
    },
    {
      "name": "saad-work",
      "tip": "9a18b84",
      "lastCommitDate": "2025-08-16",
      "lastAuthor": "Saadullah Khan",
      "lastAuthorEmail": "bob@example.com"
    }
  ],
  "branchStats": [
    {
      "branch": "main",
      "commits": 6,
      "merges": 1,
      "authors": 2,
      "authorList": [
        "AdilAhmedShekhani <alice@example.com>",
        "Saadullah Khan <bob@example.com>"
      ]
    },
    {
      "branch": "refactor",
      "commits": 9,
      "merges": 1,
      "authors": 2,
      "authorList": [
        "AdilAhmedShekhani <alice@example.com>",
        "Saadullah Khan <bob@example.com>"
      ]
    },
    {
      "branch": "saad-work",
      "commits": 4,
      "merges": 0,
      "authors": 1,
      "authorList": [
        "Saadullah Khan <bob@example.com>"
      ]
    }
  ],
  "totalCommits": 12,
  "averageCommitsPerDay": 3,
  "fileStats": [
    {
      "path": "gitviz.js",
      "changes": 4,
      "additions": 483,
      "deletions": 117
    },
    {
      "path": "gitviz-cli.js",
      "changes": 3,
      "additions": 826,
      "deletions": 38
    },
    {
      "path": "README.md",
      "changes": 2,
      "additions": 36,
      "deletions": 4
    }
  ],
  "directoryStats": [
    {
      "directory": ".",
      "changes": 9,
      "additions": 1345,
      "deletions": 159
    }
  ],
  "meta": {
    "repo": ".",
    "since": "2025-08-14",
    "until": "2025-08-17",
    "repoAgeDays": 5,
    "generated": "2025-08-17T03:29:46.207Z"
  }
}
```

---

## 8. Tips

- Asking for nothing prints help.
- Empty result sets are fine: you just get empty arrays/objects.
- Use JSON for machine pipelines; text for eyeballs or quick filters.
- `--meta` is opt‑in (keeps output lean by default).

---

## 9. Exit Codes

- 0 = success
- Non‑zero = git failure or invalid repo path

---

## 10. Recap

Composable flags. Minimal output. Text first, JSON when asked. Meta only if you want it.

---

Enjoy.
