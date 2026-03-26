#!/usr/bin/env python3
"""
Paisa AI — Smart Python Server
Serves static files AND proxies Anthropic API calls (no CORS issues!)
"""

import http.server
import json
import urllib.request
import urllib.error
import os
import sys

PORT = int(os.environ.get("PORT", 8080))

class PaisaHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args):
        # Only log errors, not every request
        if args and str(args[1]) not in ('200', '304'):
            print(f"  {args[0]} → {args[1]}")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            self._proxy_anthropic()
        else:
            self.send_response(404)
            self.end_headers()

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version')

    def _proxy_anthropic(self):
        try:
            # Read request body
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            data   = json.loads(body)

            api_key = data.pop('api_key', '')
            if not api_key:
                self._json_error(401, 'No API key provided')
                return

            # Forward to Anthropic
            req = urllib.request.Request(
                'https://api.anthropic.com/v1/messages',
                data=json.dumps(data).encode(),
                headers={
                    'Content-Type':      'application/json',
                    'x-api-key':         api_key,
                    'anthropic-version': '2023-06-01',
                },
                method='POST'
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                result = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._cors_headers()
                self.end_headers()
                self.wfile.write(result)
                print(f"  ✅ AI response sent successfully")

        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            print(f"  ❌ Anthropic error {e.code}: {err_body[:200]}")
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self._cors_headers()
            self.end_headers()
            self.wfile.write(err_body.encode())

        except urllib.error.URLError as e:
            print(f"  ❌ Network error: {e.reason}")
            self._json_error(503, f'Cannot reach Anthropic servers: {e.reason}')

        except Exception as e:
            print(f"  ❌ Server error: {e}")
            self._json_error(500, str(e))

    def _json_error(self, code, message):
        body = json.dumps({'error': {'message': message}}).encode()
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
            print(f'  Try closing the other server window first.')
        else:
            print(f'  ERROR: {e}')
        sys.exit(1)
