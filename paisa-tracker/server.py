#!/usr/bin/env python3
"""
Paisa AI — Smart Python Server
Serves static files AND proxies OpenAI API calls (no CORS issues!)
"""

import http.server
import json
import urllib.request
import urllib.error
import os
import sys

# Use dynamic port for deployment platforms like Render
PORT = int(os.environ.get("PORT", 8080))

class PaisaHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args):
        # Only log errors, not every request
        if args and str(args[1]) not in ('200', '304'):
            print(f"  {args[0]} → {args[1]}")

    # Handle CORS preflight requests
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    # Handle POST requests to the AI endpoint
    def do_POST(self):
        if self.path == '/api/chat':
            self._proxy_openai()
        else:
            self.send_response(404)
            self.end_headers()

    # Common CORS headers
    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    # Proxy request to OpenAI
    def _proxy_openai(self):
        try:
            # Read request body
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)

            # Retrieve API key from environment variable
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                self._json_error(500, "OpenAI API key not configured")
                return

            # Extract user message from frontend
            user_message = data.get("message", "")
            if not user_message:
                self._json_error(400, "No message provided")
                return

            # Prepare payload for OpenAI Responses API
            payload = {
                "model": "gpt-4o-mini",
                "input": user_message
            }

            # Create HTTP request to OpenAI
            req = urllib.request.Request(
                "https://api.openai.com/v1/responses",
                data=json.dumps(payload).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                },
                method="POST"
            )

            # Send request and parse response
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())

            # Safely extract AI-generated text
            ai_text = "No response from AI."
            if "output" in result:
                for item in result["output"]:
                    if item.get("type") == "message":
                        ai_text = item["content"][0].get("text", ai_text)
                        break

            # Format response to match Anthropic-style frontend
            formatted_response = {
                "content": [
                    {
                        "type": "text",
                        "text": ai_text
                    }
                ]
            }

            # Send response back to frontend
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(formatted_response).encode())

            print("  ✅ OpenAI response sent successfully")

        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            print(f"  ❌ OpenAI error {e.code}: {err_body[:200]}")
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self._cors_headers()
            self.end_headers()
            self.wfile.write(err_body.encode())

        except urllib.error.URLError as e:
            print(f"  ❌ Network error: {e.reason}")
            self._json_error(503, f"Cannot reach OpenAI servers: {e.reason}")

        except Exception as e:
            print(f"  ❌ Server error: {e}")
            self._json_error(500, str(e))

    # Helper function to send JSON error responses
    def _json_error(self, code, message):
        body = json.dumps({'error': {'message': message}}).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    # Ensure the server serves files from the project directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print()
    print('  ╔══════════════════════════════════════╗')
    print('  ║   PAISA AI — Expense Tracker         ║')
    print('  ╚══════════════════════════════════════╝')
    print()
    print(f'  Server running at: http://localhost:{PORT}')
    print(f'  Open Chrome and go to: http://localhost:{PORT}')
    print()
    print('  Press Ctrl+C to stop.')
    print()

    try:
        server = http.server.HTTPServer(('', PORT), PaisaHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped.')
    except OSError as e:
        if 'Address already in use' in str(e):
            print(f'  ERROR: Port {PORT} is already in use.')
            print('  Try closing the other server window first.')
        else:
            print(f'  ERROR: {e}')
        sys.exit(1)