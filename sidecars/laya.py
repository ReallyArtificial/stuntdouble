#!/usr/bin/env python3
"""Expose laya-mlx (Apple Silicon typed-decision model) on POST /v1/systemone.

    pip install laya-mlx            # Python 3.11+, macOS 14+, Apple Silicon
    python sidecars/laya.py --port 8011 [--model aac6fef/laya-mlx]

Then add {"name": "laya", "url": "http://127.0.0.1:8011"} to your stuntdouble doubles.
Standard library only; the model is loaded once at startup.
"""
import argparse
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def make_handler(agent, model_name):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):  # quiet
            pass

        def _send(self, status, body):
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                return self._send(200, {"ok": True, "model": model_name})
            self._send(404, {"error": "not found"})

        def do_POST(self):
            if self.path != "/v1/systemone":
                return self._send(404, {"error": "not found"})
            try:
                req = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
                state, questions = req["state"], req["questions"]
            except Exception as e:  # noqa: BLE001
                return self._send(400, {"error": f"bad request: {e}"})
            if not isinstance(state, str):
                state = json.dumps(state, ensure_ascii=False, indent=2)
            t = time.perf_counter()
            try:
                result = agent.predict(state, questions)
            except Exception as e:  # noqa: BLE001
                return self._send(500, {"error": f"laya: {e}"})
            answers = {}
            for qid, a in result["answers"].items():
                a = {k: v for k, v in a.items() if k != "action"}  # laya-specific field, not in the wire shape
                answers[qid] = a
            self._send(200, {
                "model": model_name,
                "answers": answers,
                "usage": result.get("usage") or {"input_tokens": 0, "output_tokens": 0},
                "latency_ms": round((time.perf_counter() - t) * 1000),
            })

    return Handler


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8011)
    ap.add_argument("--model", default="aac6fef/laya-mlx")
    a = ap.parse_args()
    import laya_mlx  # noqa: WPS433
    agent = laya_mlx.load(a.model)
    name = f"laya:{a.model.split('/')[-1]}"
    server = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(agent, name))
    print(f"laya sidecar on http://127.0.0.1:{a.port}/v1/systemone ({name})", file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()
