<!-- Updated README with --full-history support and expanded meta fields -->

# GitViz - CLI Client

Minimal Git inspector. Ask for only the data blocks you want (contributors, branches, file/directory change activity, frequencies, etc.).

Default output is plain text: one fact per line, easy to scan or pipe into `findstr` / `grep`. Add `--format json` (or shorthand `--json`) for machine consumption. Add `--meta` for repo + range metadata.

> Code churn = additions + deletions (change volume), often shown with change counts.

Time window behavior:

-   If you specify none of `--since`, `--until`, or `--days`, a 30‑day rolling window is applied (fast + relevant).
-   Use `--full-history` to override and analyze the entire lifetime (first commit → today) unless you supply your own explicit range.
-   Any explicit range flag disables the default.

---

## 1. What It Helps You Answer

-   Who contributes (and how much)?
-   How many commits per day / week / month? Per author? Per branch?
-   Which branches are active / merged? Unique authors per branch?
-   Which files / directories churn the most?
-   Line additions / deletions per contributor?

You choose flags; output only includes requested blocks. No colors; minimal noise.

---

## 2. Argument Forms

### Boolean falgs:

Boolean flags stand alone: `--all`, `--contributors`, etc.

### Key-value pairs format:

Every value‑taking flag accepts all forms:

-   Space: `--format json`
-   Equals: `--format=json`
-   Brackets: `--format[json]`
-   Some also accept the value as the next token.

### Time / range flags: Priority Order (Highest to Lowest):

-   `--full-history` → Overrides everything, uses entire repo history
    -   Example: `node gitviz.js --commit-frequency --days 5 --since 2025-08-14 --until 2025-08-20 --full-history`, all filters got ignored, from beginning to the today
-   `--since`/`--until` → Overrides --days
    -   Example: `node gitviz.js --commit-frequency --days 5 --since 2025-08-14 --until 2025-08-20`, days got ignored.
-   `--days` → Only works if none of the above are specified
    -   Example: `node gitviz.js --commit-frequency --days 5`, 5 days back from today.
-   Default 30-day window → Fallback when nothing is specified

### Scope / filter:

-   `--repo <path>` (default `.`)
-   `--all` (all refs)
-   `--author <pattern>` (git author regex)

### Output selection:

-   `--format json` or `--json`
-   `--meta` (add meta section)

### Help: `-h` / `--help`

---

## 3. Output Formats

### Plain Text (default)

Rules:

-   One logical fact per line: `key: value`.
-   Arrays of objects print as blocks separated by one blank line.
-   Maps (date → count) print directly as lines.
-   Meta (if requested) prints first.

Example meta:

```
repo: .
since: 2025-07-19
until: 2025-08-17
repoAgeDays: 7420
generated: 2025-08-17T02:12:25.405Z
```

### JSON

Only the sections you requested (plus meta when `--meta`).

Auto 30‑day window example:

```json
{
    "meta": {
        "repo": ".",
        "since": "2025-07-19",
        "until": "2025-08-17",
        "repoAgeDays": 7420,
        "firstCommitDate": "2005-04-07",
        "rangeDays": 30,
        "generated": "2025-08-17T02:13:25.741Z"
    }
}
```

Full history example:

```json
{
    "meta": {
        "repo": ".",
        "since": "2005-04-07",
        "until": "2025-08-17",
        "repoAgeDays": 7420,
        "firstCommitDate": "2005-04-07",
        "rangeDays": 7420,
        "generated": "2025-08-17T02:15:41.123Z"
    }
}
```

---

## 4. Data Flags

| Flag                           | Description                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `--all`                        | Include all refs                                                                  |
| `--contributors`               | List authors with commit counts.                                                  |
| `--top N`                      | Top N contributors (implies `--contributors`).                                    |
| `--author <pattern>`           | Filter by author                                                                  |
| `--contributor-stats`          | Commits + additions + deletions per author.                                       |
| `--commit-frequency[=g]`       | Commits grouped by `g` = `daily` (default), `weekly`, `monthly`.                  |
| `--commit-frequency-by-author` | Per-author daily commit counts.                                                   |
| `--commit-frequency-by-branch` | Commit counts per branch (respects date filters).                                 |
| `--branches`                   | Branch basic info (name, tip, last commit date, last author).                     |
| `--branch-stats`               | Commits, merges, unique author count + list per branch.                           |
| `--total-commits`              | Total commits in range.                                                           |
| `--average-commits-per-day`    | Average commits per day in range.                                                 |
| `--commit-distribution`        | Date → commit count map (daily).                                                  |
| `--file-stats`                 | Per file churn: changes, additions, deletions.                                    |
| `--directory-stats`            | Aggregated churn per directory.                                                   |
| `--meta`                       | Add meta: repo, since, until, repoAgeDays, firstCommitDate, rangeDays, generated. |
| `--full-history`               | Use entire repo history (disables default window if no explicit range).           |
| `--format json` / `--json`     | Output JSON instead of text.                                                      |

Time & scope modifiers: `--since`, `--until`, `--days`, `--full-history`, `--repo`, `--all`, `--author`.

---

## 5. Samples

### Contributors

```
node gitviz.js --contributors
```

```
name: Alice
email: alice@example.com
commits: 12

name: Bob
email: bob@example.com
commits: 4
```

### Commit Frequency (Daily)

```
node gitviz.js --commit-frequency daily
```

```
2025-08-17: 3
2025-08-16: 3
2025-08-15: 2
2025-08-14: 1
2025-08-13: 1
```

### Branch Stats

```
node gitviz.js --branches --branch-stats
```

(Two arrays: branches + branchStats when in JSON; tables merged by dashboard UI.)

---

## 6. Combining Flags

```
node gitviz.js --commit-frequency=weekly --total-commits --average-commits-per-day --since 2025-08-01 --until 2025-08-31
```

```
node gitviz.js --file-stats --directory-stats --since 2025-08-10
```

```
node gitviz.js --branches --branch-stats --commit-frequency-by-branch
```

JSON with meta:

```
node gitviz.js --contributors --json --meta
```

---

## 7. Full Example

Goal: last 14 days, all refs, one author pattern, churn + frequencies.

```
node gitviz.js \
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

Excerpt of JSON (meta fields updated):

```json
{
    "totalCommits": 12,
    "averageCommitsPerDay": 3,
    "meta": {
        "repo": ".",
        "since": "2025-08-14",
        "until": "2025-08-17",
        "repoAgeDays": 7420,
        "firstCommitDate": "2005-04-07",
        "rangeDays": 4,
        "generated": "2025-08-17T03:29:46.207Z"
    }
}
```

---

## 8. Tips

-   Asking for nothing prints help.
-   Empty sets just show empty arrays/objects.
-   Use JSON for pipelines; text for quick terminal scans.
-   `--full-history` can be slow on massive repos; prefer range narrowing when exploring.

---

## 9. Exit Codes

-   0 = success
-   Non‑zero = git failure or invalid repo path

---

## 10. Recap

Composable flags. Minimal output. Text first, JSON when asked. Meta only if you want it.

## 11. Meta Field Reference

| Field           | Meaning                                    |
| --------------- | ------------------------------------------ |
| repo            | Repository path used.                      |
| since           | Inclusive start of active analysis window. |
| until           | Inclusive end of active analysis window.   |
| repoAgeDays     | Lifetime days (first commit → today).      |
| firstCommitDate | First commit date.                         |
| rangeDays       | Inclusive length of window (since..until). |
| generated       | ISO‑8601 UTC timestamp of generation.      |

If no window flags: auto 30‑day window unless `--full-history`.

---

Enjoy.
