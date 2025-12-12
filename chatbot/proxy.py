#!/usr/bin/env python3
"""Simple HTTP proxy that binds to PORT and forwards requests to an
internal Rasa server running on RASA_INTERNAL_PORT. Starts immediately so
Render's port scanner sees an open port while the model is loading.

This proxy returns 503 when the upstream is not yet ready.
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
import http.client
import urllib.parse

PORT = int(os.environ.get("PORT", "5005"))
INTERNAL_PORT = int(os.environ.get("RASA_INTERNAL_PORT", "5005"))
UPSTREAM_HOST = '127.0.0.1'


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def _proxy_request(self):
        try:
            conn = http.client.HTTPConnection(UPSTREAM_HOST, INTERNAL_PORT, timeout=5)
            path = self.path
            # Forward headers
            headers = {k: v for k, v in self.headers.items()}
            # Read body if present
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length > 0 else None
            conn.request(self.command, path, body=body, headers=headers)
            resp = conn.getresponse()
        except Exception:
            return None

        return resp

    def _send_upstream_response(self, resp):
        self.send_response(resp.status, resp.reason)
        for k, v in resp.getheaders():
            # Hop-by-hop headers should not be forwarded
            if k.lower() in ("connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade"):
                continue
            self.send_header(k, v)
        self.end_headers()
        chunk = resp.read()
        if chunk:
            self.wfile.write(chunk)

    def do_GET(self):
        resp = self._proxy_request()
        if resp is None:
            # Upstream not ready
            self.send_response(503)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Rasa upstream not ready')
            return
        self._send_upstream_response(resp)

    def do_POST(self):
        return self.do_GET()

    def log_message(self, format, *args):
        sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format%args))


def run():
    server = HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    print(f"Proxy listening on 0.0.0.0:{PORT}, forwarding to {UPSTREAM_HOST}:{INTERNAL_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    run()
