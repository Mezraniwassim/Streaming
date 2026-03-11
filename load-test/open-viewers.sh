#!/usr/bin/env bash
# open-viewers.sh — Open N real browser tabs pointing to the viewer page
#
# Usage:
#   bash open-viewers.sh [viewers] [room] [base-url]
#
# Examples:
#   bash open-viewers.sh 10 my-stream
#   bash open-viewers.sh 50 my-stream http://localhost:5173
#   bash open-viewers.sh 5 my-stream https://your-app.vercel.app

NUM_VIEWERS=${1:-10}
ROOM=${2:-"load-test-room"}
BASE_URL=${3:-"http://localhost:5173"}

# Simple URL-safe encoding: replace spaces with %20 (room names with hyphens need no encoding)
ENCODED_ROOM=$(echo "${ROOM}" | sed 's/ /%20/g')
WATCH_URL="${BASE_URL}/watch?room=${ENCODED_ROOM}"

echo ""
echo "======================================================="
echo "  Live Streaming — Browser Load Test"
echo "======================================================="
echo "  Opening ${NUM_VIEWERS} viewer tabs"
echo "  Room:    ${ROOM}"
echo "  URL:     ${WATCH_URL}"
echo "======================================================="
echo ""

# Detect browser
if command -v google-chrome &>/dev/null; then
  BROWSER="google-chrome"
elif command -v chromium-browser &>/dev/null; then
  BROWSER="chromium-browser"
elif command -v chromium &>/dev/null; then
  BROWSER="chromium"
elif command -v firefox &>/dev/null; then
  BROWSER="firefox"
else
  echo "  ✗ No supported browser found (chrome/chromium/firefox)"
  echo "    Manually open this URL in ${NUM_VIEWERS} tabs:"
  echo "    ${WATCH_URL}"
  exit 1
fi

echo "  Browser: ${BROWSER}"
echo ""

for i in $(seq 1 "${NUM_VIEWERS}"); do
  VIEWER_URL="${WATCH_URL}&name=viewer-${i}"
  echo "  Opening tab ${i}/${NUM_VIEWERS} — viewer-${i} → ${ROOM}"
  $BROWSER --new-tab "${VIEWER_URL}" &>/dev/null &
  sleep 10
done

echo ""
echo "  ✓ ${NUM_VIEWERS} tabs opened — each viewer auto-joins as viewer-1 … viewer-${NUM_VIEWERS}"
echo "  → Watch http://localhost:5173 to see participant count update live"
echo ""
