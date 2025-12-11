#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./publish_model.sh ./models/<model-file>.tar.gz v1.0 "release-notes"
# Requires: GitHub CLI (`gh`) authenticated with access to the repo.

MODEL_PATH=${1:-}
RELEASE_TAG=${2:-}
RELEASE_NOTES=${3:-"Model release uploaded via script"}

if [ -z "$MODEL_PATH" ] || [ -z "$RELEASE_TAG" ]; then
  echo "Usage: $0 <model-path> <release-tag> [release-notes]"
  exit 2
fi

if [ ! -f "$MODEL_PATH" ]; then
  echo "Model file not found: $MODEL_PATH"
  exit 3
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) not found. Install from https://cli.github.com/ and authenticate with 'gh auth login'"
  exit 4
fi

REPO_OWNER=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
echo "Publishing $MODEL_PATH to GitHub Releases for repo $REPO_OWNER with tag $RELEASE_TAG"

# Create or update a release
if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  echo "Release $RELEASE_TAG exists — uploading asset"
else
  echo "Creating release $RELEASE_TAG"
  gh release create "$RELEASE_TAG" -t "$RELEASE_TAG" -n "$RELEASE_NOTES"
fi

echo "Uploading asset..."
gh release upload "$RELEASE_TAG" "$MODEL_PATH" --clobber

ASSET_URL=$(gh release view "$RELEASE_TAG" --json assets -q '.assets[0].url')
echo "Upload complete. Release tag: $RELEASE_TAG"
echo "Asset URL: $ASSET_URL"
echo "Use this URL as MODEL_URL in Render (or generate a signed URL if you need limited access)."
