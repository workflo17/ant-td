"""Dev server for Grubs TD: static files with no-store caching so edits always load fresh."""
import functools
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keep-alive: module-heavy loads reuse connections instead of opening
    # ~22 fresh sockets, which intermittently die (ERR_CONNECTION_RESET) behind
    # localhost-filtering antivirus.
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5410
    root = sys.argv[2] if len(sys.argv) > 2 else '.'
    ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=root)).serve_forever()
