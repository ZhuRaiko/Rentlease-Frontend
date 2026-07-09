import json
from http.server import BaseHTTPRequestHandler, HTTPServer

from recommender import rank_listings


class RecommendationHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send_headers(204)

    def do_POST(self):
        if self.path != "/recommendations":
            self._send_json({"error": "Not found"}, 404)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body or "{}")
            recommendations = rank_listings(
                payload.get("preference", {}),
                payload.get("listings", []),
            )
            self._send_json({"recommendations": recommendations})
        except Exception as exc:
            self._send_json({"error": str(exc)}, 400)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self._send_headers(status, len(body))
        self.wfile.write(body)

    def _send_headers(self, status=200, length=0):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json")
        if length:
            self.send_header("Content-Length", str(length))
        self.end_headers()


def run(host="127.0.0.1", port=8000):
    server = HTTPServer((host, port), RecommendationHandler)
    print(f"RentLease recommendation backend running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
