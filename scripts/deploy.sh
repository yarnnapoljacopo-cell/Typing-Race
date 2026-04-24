#!/usr/bin/env bash
# deploy.sh — merge development → main and trigger a Railway production deploy
# Usage: pnpm run deploy  (from anywhere in the repo)
set -euo pipefail

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo ""
echo "=== Writing Sprint — Deploy to Production ==="
echo ""

# Must be on development to deploy
if [ "$CURRENT_BRANCH" != "development" ]; then
  echo "ERROR: You must be on the 'development' branch to deploy."
  echo "       Run: git checkout development"
  exit 1
fi

# Make sure there are no uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: You have uncommitted changes. Commit or stash them first."
  exit 1
fi

echo "1/4  Pulling latest development..."
git pull origin development

echo "2/4  Switching to main..."
git checkout main
git pull origin main

echo "3/4  Merging development → main..."
git merge development --no-edit

echo "4/4  Pushing main to GitHub (this triggers Railway production deploy)..."
git push origin main

echo ""
echo "Done! Railway will now build and deploy the production service."
echo "      Watch progress at: https://railway.app"
echo ""

# Switch back to development so the user keeps working there
git checkout development
echo "Switched back to development branch."
echo ""
