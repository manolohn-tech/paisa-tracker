#!/usr/bin/env python3
"""
Paisa AI — Smart Python Server (OpenAI Version)
Serves static files AND proxies OpenAI API calls (no CORS issues!)
"""

import http.server
import json
import urllib.request
import urllib.error
import os
import sys

# Use Render's PORT environment variable, default to 8080 for local use
PORT = int(os.environ.get("PORT", 8080))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")


class PaisaHandler(http.server.SimpleHTTPRequestHandler):

    # Log only errors
    def log_message(self, format, *args):
        if args and str(args[1]) not in ('200', '304'):
            print(f"{args[0]} → {args[1]}")

    # Handle CORS preflight
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    # Handle POST requests
    def do_POST(self):
        if self.path == '/api/chat':
            self._proxy_openai()
        else:
            self.send_response(404)
            self.end_headers()

    # CORS headers
    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    # Proxy request to OpenAI
    def _proxy_openai(self):
        if not OPENAI_API_KEY:
            self._json_error(500, "OPENAI_API_KEY environment variable not set.")
            return

        try:
            # Read request body from frontend
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)

            user_message = data.get("message", "")

            # Prepare request to OpenAI
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are Paisa AI, a helpful personal finance assistant for Indian students. Respond in concise and friendly language."
                    },
                    {
                        "role": "user",
                        "content": user_message
                    }
                ],
                "temperature": 0.7
            }

            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENAI_API_KEY}"
                },
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                result = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._cors_headers()
                self.end_headers()
                self.wfile.write(result)
                print("✅ OpenAI response sent successfully")

        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            print(f"❌ OpenAI error {e.code}: {err_body}")
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self._cors_headers()
            self.end_headers()
            self.wfile.write(err_body.encode())

        except urllib.error.URLError as e:
            print(f"❌ Network error: {e.reason}")
            self._json_error(503, f"Cannot reach OpenAI servers: {e.reason}")

        except Exception as e:
            print(f"❌ Server error: {e}")
            self._json_error(500, str(e))

    # Send JSON error response
    def _json_error(self, code, message):
        body = json.dumps({"error": {"message": message}}).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print()
    print('  ╔══════════════════════════════════════╗')
    print('  ║   PAISA AI — Expense Tracker         ║')
    print('  ╚══════════════════════════════════════╝')
    print()
    print(f'  Server running at: http://localhost:{PORT}')
    print()

    try:
        server = http.server.HTTPServer(('', PORT), PaisaHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
    except OSError as e:
        print(f'ERROR: {e}')
        sys.exit(1)