#!/bin/bash
# Git Log Visualizer - Shell Version (Basic Start)

# Argument se repo ka path lo, default current directory
REPO=${1:-.}

# Check karo ke repo valid hai ya nahi
if [ ! -d "$REPO/.git" ]; then
  echo "❌ Not a valid git repo: $REPO"
  exit 1
fi

echo "✅ Repo found: $REPO"

while true; do
  echo
  echo "===================================="
  echo "   🌟 Git Log Visualizer - Menu 🌟"
  echo "===================================="
  echo "1) 📊 Commit Frequency (last 7 days)"
  echo "2) 👨‍💻 Top Contributors (last 7 days)"
  echo "3) 🌿 Branches Summary"
  echo "4) 📋 Show All"
  echo "5) ❌ Exit"
  echo "------------------------------------"
  echo -n "Choose an option [1-5]: "
  read choice

  case $choice in
    1)
      echo
      echo "📊 Commit Frequency (last 7 days)"
      echo "--------------------------------"
      echo "Date        | Commits"
      echo "------------+--------"
      git -C "$REPO" log --date=short --pretty=format:"%ad" --since="7 days ago" \
        | sort | uniq -c | awk '{printf "%-10s | %d\n",$2,$1}'
      ;;
    2)
      echo
      echo "👨‍💻 Top Contributors (last 7 days)"
      echo "--------------------------------"
      echo "Rank | Author                | Commits"
      echo "-----+-----------------------+--------"
      git -C "$REPO" log --since="7 days ago" --pretty=format:"%an" \
        | sort | uniq -c | sort -nr | head -5 \
        | awk '{printf "%-4s | %-21s | %d\n", NR, substr($0,index($0,$2)),$1}'
      ;;
    3)
      echo
      echo "🌿 Branches (local)"
      echo "--------------------------------"
      echo "Mark | Branch               | Last Commit"
      echo "-----+----------------------+------------"
      git -C "$REPO" for-each-ref --sort=-committerdate refs/heads/ \
        --format="%(if)%(HEAD)%(then)*%(else) %(end)|%(refname:short)|%(committerdate:short)" \
        | while IFS="|" read mark branch date; do
            printf "%-4s | %-20s | %s\n" "$mark" "$branch" "$date"
          done
      ;;
    4)
      echo
      echo "📋 Showing All Sections"
      echo "========================="
      
      # Commit Frequency
      echo
      echo "📊 Commit Frequency (last 7 days)"
      echo "--------------------------------"
      echo "Date        | Commits"
      echo "------------+--------"
      git -C "$REPO" log --date=short --pretty=format:"%ad" --since="7 days ago" \
        | sort | uniq -c | awk '{printf "%-10s | %d\n",$2,$1}'

      # Top Contributors
      echo
      echo "👨‍💻 Top Contributors (last 7 days)"
      echo "--------------------------------"
      echo "Rank | Author                | Commits"
      echo "-----+-----------------------+--------"
      git -C "$REPO" log --since="7 days ago" --pretty=format:"%an" \
        | sort | uniq -c | sort -nr | head -5 \
        | awk '{printf "%-4s | %-21s | %d\n", NR, substr($0,index($0,$2)),$1}'

      # Branches
      echo
      echo "🌿 Branches (local)"
      echo "--------------------------------"
      echo "Mark | Branch               | Last Commit"
      echo "-----+----------------------+------------"
      git -C "$REPO" for-each-ref --sort=-committerdate refs/heads/ \
        --format="%(if)%(HEAD)%(then)*%(else) %(end)|%(refname:short)|%(committerdate:short)" \
        | while IFS="|" read mark branch date; do
            printf "%-4s | %-20s | %s\n" "$mark" "$branch" "$date"
          done
      ;;
    5)
      echo "👋 Bye, exiting..."
      exit 0
      ;;
    *)
      echo "❌ Invalid choice, please select 1-5."
      ;;
  esac
done
