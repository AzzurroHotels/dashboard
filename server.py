"""
Azzurro Hotels — Local Development Server
Serves static files and proxies AI chat requests through Groq.

Usage:  python server.py
Open:   http://localhost:5000
"""

import http.server
import json
import os
import urllib.request

PORT = 5000

GROQ_KEY = os.environ.get("GROQ_KEY", "")
if not GROQ_KEY:
    # Try loading from .env file
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("GROQ_KEY="):
                    GROQ_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM = "You are a helpful AI assistant for Azzurro Hotels. Help staff with hotel operations, guest management, scheduling, and policies. Be concise and professional. Use markdown formatting."
HEADERS = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}


def call_groq(messages, system_prompt=None):
    msgs = [{"role": "system", "content": system_prompt or SYSTEM}] + messages

    body = json.dumps({
        "model": "llama-3.1-8b-instant",
        "messages": msgs,
        "temperature": 0.7,
        "max_tokens": 1024,
    }).encode()

    headers = {**HEADERS, "Authorization": f"Bearer {GROQ_KEY}"}
    req = urllib.request.Request(GROQ_URL, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
        return data["choices"][0]["message"]["content"]


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/chat":
            self._handle_chat()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _handle_chat(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            messages = payload.get("messages", [])
            system_prompt = payload.get("system", None)

            reply = call_groq(messages, system_prompt)
            print(f"  [Groq] OK")
            self._json_response(200, {
                "reply": reply,
                "provider": "groq",
            })

        except Exception as e:
            print(f"  [Groq] Failed: {e}")
            self._json_response(503, {
                "error": str(e),
                "provider": "offline",
            })

    def log_message(self, fmt, *args):
        msg = str(args[0]) if args else ""
        if "/api/chat" in msg:
            return
        if not any(x in msg for x in [".ico", ".map"]):
            print(f"  {msg}")


if __name__ == "__main__":
    print(f"\n  Azzurro Hotels — Dev Server")
    print(f"  http://localhost:{PORT}")
    print(f"  AI proxy: Groq LLaMA\n")
    server = http.server.HTTPServer(("", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
