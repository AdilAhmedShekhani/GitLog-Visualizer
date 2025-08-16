# GitLog-Visualizer 🧠📊

A lightweight and dependency-free **command-line Git log visualizer** built using Node.js. This CLI tool helps developers quickly analyze:

- 🔁 Commit frequency (in the last _N_ days)
- 🧑‍💻 Top contributors (by commit count)
- 🌿 Local branches summary

All through clean, colored ASCII output directly in the terminal.

---

## 🚀 Features

- **Commit Frequency Graph** over the past _N_ days
- **Top Contributors** with commit share and percentages
- **Branches Summary** including tip SHA, last commit date, and commit count
- **Author filtering** using regex
- Works with **any Git repository** (just point with `--repo`)
- **No external dependencies** — pure Node.js + Git CLI

---

## 📦 Installation

No installation needed — it's a single-file script.  
Just clone the repo and run it with Node.js:

```bash
git clone https://github.com/your-username/GitLog-Visualizer.git
cd GitLog-Visualizer
node gitviz.js
