"""SSE delivery through the deployed nginx configuration and its public port."""

import json
import subprocess
import threading
import time
import unittest
import urllib.error
import urllib.request
import uuid

from tests.test_nginx_webhook_proxy import CONFIG, docker

STUB = r"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading

started = threading.Event()
release = threading.Event()

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path == "/healthcheck":
            self.send_response(204)
            self.end_headers()
        elif self.path == "/api/stream-test/release":
            release.set()
            self.send_response(204)
            self.end_headers()
        elif self.path == "/api/stream-test/state":
            body = json.dumps({"started": started.is_set(), "released": release.is_set()}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.endswith("/events/stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(b'event: review.snapshot\ndata: {"status":"QUEUED"}\n\n')
            self.wfile.flush()
            started.set()
            release.wait(timeout=10)
            self.close_connection = True
        else:
            self.send_error(404)

ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
"""


class NginxReviewStreamTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        suffix = uuid.uuid4().hex[:12]
        cls.network = f"review-stream-test-{suffix}"
        cls.api = f"review-stream-api-{suffix}"
        cls.nginx = f"review-stream-nginx-{suffix}"
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
                raise RuntimeError("nginx did not start")
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        for container in (cls.nginx, cls.api):
            subprocess.run(["docker", "rm", "-f", container], capture_output=True)
        subprocess.run(["docker", "network", "rm", cls.network], capture_output=True)

    def test_first_event_arrives_while_upstream_is_still_open(self):
        delivered = threading.Event()
        received = []
        failures = []

        def read_event():
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{self.port}/api/v1/reviews/"
                    "aab94531-476f-4a9c-88eb-41ba84f9884c/events/stream",
                    timeout=10,
                ) as response:
                    received.append(response.readline())
                    received.append(response.readline())
                    received.append(response.readline())
                    delivered.set()
            except Exception as error:
                failures.append(error)

        reader = threading.Thread(target=read_event, daemon=True)
        reader.start()
        try:
            arrived_before_release = delivered.wait(timeout=2)
            with urllib.request.urlopen(
                f"http://127.0.0.1:{self.port}/api/stream-test/state", timeout=2
            ) as response:
                state = json.load(response)
            self.assertTrue(state["started"])
            self.assertFalse(state["released"])
            self.assertTrue(
                arrived_before_release,
                "nginx buffered the first SSE event while upstream remained open",
            )
            self.assertEqual(
                b"".join(received),
                b'event: review.snapshot\ndata: {"status":"QUEUED"}\n\n',
            )
            self.assertEqual(failures, [])
        finally:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{self.port}/api/stream-test/release", timeout=2
            ):
                pass
            reader.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
