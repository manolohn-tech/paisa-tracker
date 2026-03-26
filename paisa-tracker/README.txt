============================================================
  PAISA AI — Student Expense Tracker
  God-Level Edition with AI + Voice + IndexedDB
============================================================

PROJECT FILES:
  index.html       — Main app
  style.css        — All styles
  js/db.js         — IndexedDB database layer
  js/app.js        — Tracker, budget, history, CSV export
  js/ai.js         — AI assistant + Voice input
  START.bat        — Windows launcher (DOUBLE-CLICK THIS)
  start.sh         — Mac/Linux launcher

============================================================
  HOW TO RUN (WINDOWS) — READ THIS CAREFULLY
============================================================

STEP 1: Make sure Python is installed
  - Open Command Prompt and type: python --version
  - If not installed: https://python.org/downloads
  - During install, CHECK "Add Python to PATH"

STEP 2: Double-click START.bat
  - A black window (command prompt) will open
  - Chrome will open automatically at http://localhost:8080
  - DO NOT close the black window while using the app

That's it! The app will work perfectly.

============================================================
  WHY YOU MUST USE START.bat (NOT double-click index.html)
============================================================

When you open index.html directly, the browser treats it as:
  file:///C:/Users/.../index.html

Browsers BLOCK all API calls from "file://" for security.
This is why you see "Failed to fetch" errors.

When you use START.bat, it runs a local web server, so
the browser opens: http://localhost:8080/index.html

From http://localhost, ALL API calls work correctly.

============================================================
  FEATURES
============================================================

TRACKER TAB:
  ✓ Add expenses with form (Description, Amount, Date, Category)
  ✓ Set monthly budget with live remaining calculation
  ✓ Search and filter expenses by category
  ✓ Sort by date (newest/oldest)
  ✓ Delete individual expenses
  ✓ Export CSV (with UTF-8 encoding for Excel compatibility)
  ✓ SVG donut chart (no external libraries)
  ✓ Progress bar turns orange at 80%, red at 100%
  ✓ Budget alert banners

AI + VOICE TAB:
  ✓ Type naturally: "spent 150 on mess today"
  ✓ Multiple expenses: "chai 30, auto 60, lunch 120"
  ✓ Relative dates: "yesterday", "last Monday"
  ✓ Ask questions: "how much did I spend on food?"
  ✓ Set budget: "set my budget to 5000"
  ✓ Voice input with live waveform visualization
  ✓ 8 Indian languages supported
  ✓ Success chime sound when expense added
  ✓ Expenses shown as cards with "✓ DB Saved" badge

HISTORY TAB:
  ✓ Month cards showing spent vs budget
  ✓ Click any month to jump to it
  ✓ Full table of all months
  ✓ Status badges (surplus/over/no budget)

DATABASE:
  ✓ IndexedDB — data persists forever in browser
  ✓ Works even after closing/reopening Chrome
  ✓ No server needed for data storage
  ✓ Automatic DB status indicator in header

============================================================
  VOICE INPUT SETUP
============================================================

1. Use Chrome or Edge browser (required for voice API)
2. Click the 🎙️ mic button in AI + Voice tab
3. When browser asks for microphone — click ALLOW
4. Click "▶ Start Listening" and speak
5. Watch your words appear in real-time
6. Click "⏹ Stop" then "Send to AI ✦"

Languages supported:
  English (India) · English (US) · Hindi · Tamil
  Telugu · Kannada · Malayalam · Marathi

============================================================
  TROUBLESHOOTING
============================================================

"Failed to fetch" error:
  → You opened index.html directly. Use START.bat instead.
  → Make sure the black CMD window is still open.

Voice not working:
  → Use Chrome or Edge (Firefox doesn't support Web Speech API)
  → Click Allow when browser asks for microphone permission
  → Check Windows microphone settings

Black CMD window closed:
  → Double-click START.bat again

Python not found:
  → Install from python.org
  → Check "Add to PATH" during installation
  → Restart Command Prompt after installing

============================================================
  MADE WITH LOVE FOR ENGINEERING STUDENTS
============================================================
