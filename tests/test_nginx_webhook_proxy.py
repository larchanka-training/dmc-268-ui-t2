"""Exercise the deployed Nginx config through its public HTTP port."""

import hashlib
import hmac
import subprocess
import time
import unittest
import urllib.error
import urllib.request
import uuid
from pathlib import Path


CONFIG = Path(__file__).resolve().parents[1] / "nginx" / "default.conf"
SECRET = b"nginx-test-secret"
STUB = r"""
from http.server import BaseHTTPRequestHandler, HTTPServer
import hashlib
import hmac

SECRET = b"nginx-test-secret"

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        signature = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
        if self.headers.get("X-Hub-Signature-256") != signature:
            self.send_error(401)
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.write(str(len(body)).encode())

HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
"""


def docker(*args):
    return subprocess.run(
        ["docker", *args], check=True, capture_output=True, text=True
    ).stdout.strip()


class NginxWebhookProxyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        suffix = uuid.uuid4().hex[:12]
        cls.network = f"webhook-proxy-test-{suffix}"
        cls.api = f"webhook-api-test-{suffix}"
        cls.nginx = f"webhook-nginx-test-{suffix}"
        docker("network", "create", cls.network)
        try:
            docker(
                "run", "--rm", "-d", "--network", cls.network,
                "--network-alias", "api", "--name", cls.api,
                "python:3.14-alpine", "python", "-u", "-c", STUB,
            )
            docker(
                "run", "--rm", "-d", "--network", cls.network,
                "--name", cls.nginx, "-p", "127.0.0.1::80",
                "-v", f"{CONFIG}:/etc/nginx/conf.d/default.conf:ro",
                "nginx:1.28-alpine",
            )
            cls.port = int(docker("port", cls.nginx, "80/tcp").rsplit(":", 1)[1])
            for _ in range(40):
                try:
                    with urllib.request.urlopen(
                        f"http://127.0.0.1:{cls.port}/healthcheck", timeout=1
                    ) as response:
                        if response.status == 204:
                            break
                except urllib.error.URLError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Nginx did not start")
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        for container in (cls.nginx, cls.api):
            subprocess.run(["docker", "rm", "-f", container], capture_output=True)
        subprocess.run(["docker", "network", "rm", cls.network], capture_output=True)

    def post(self, path, body):
        signature = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=body,
            headers={"X-Hub-Signature-256": signature},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_only_github_webhook_accepts_signed_body_above_default_limit(self):
        body = b"x" * (2 * 1024 * 1024)
        self.assertEqual(self.post("/api/v1/webhooks/github", body), (200, b"2097152"))
        self.assertEqual(self.post("/api/v1/reviews", body)[0], 413)
        self.assertEqual(
            self.post("/api/v1/webhooks/github", b"x" * (25 * 1024 * 1024 + 1))[0],
            413,
        )


if __name__ == "__main__":
    unittest.main()
