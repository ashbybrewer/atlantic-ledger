#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".json": "application/json",
        ".geojson": "application/geo+json",
    }


if __name__ == "__main__":
    address = ("127.0.0.1", 8091)
    print("Atlantic Ledger: http://127.0.0.1:8091")
    ThreadingHTTPServer(address, Handler).serve_forever()
