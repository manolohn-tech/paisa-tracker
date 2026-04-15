#!/bin/bash
echo "================================================"
echo " PAISA AI - Student Expense Tracker"
echo "================================================"
echo ""
echo " Starting local web server..."
echo " Opening at: http://localhost:8080"
echo ""

# Start server in background
python3 -m http.server 8080 &
SERVER_PID=$!

# Wait a moment then open browser
sleep 1

# Open browser (works on Mac and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:8080"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080"
else
    echo " Open this URL in Chrome: http://localhost:8080"
fi

echo " Server running (PID: $SERVER_PID)"
echo " Press Ctrl+C to stop."
echo ""

wait $SERVER_PID
