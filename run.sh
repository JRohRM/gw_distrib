#!/bin/bash
# run.sh - start webui and python script together

# Exit immediately on error
set -e

# Navigate into webui
cd "$(dirname "$0")"

# Decide which npm script to run
cd webui
if [[ "$1" == "dev" ]]; then
  NPM_CMD="npm run dev"
else
  NPM_CMD="npm start"
fi
cd ..

# Start processes in background
echo "Starting web server ($NPM_CMD)..."
( cd webui && $NPM_CMD ) &

WEBUI_PID=$!

echo "Starting Python script (rfid_gate.py)..."
python3 rfid_gate.py &

PY_PID=$!

# Cleanup on exit
trap "echo 'Stopping...'; kill $WEBUI_PID $PY_PID" SIGINT SIGTERM

# Wait for both
wait $WEBUI_PID $PY_PID
