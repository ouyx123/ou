# -*- coding: utf-8 -*-
"""Optional local static preview. No Gradio, model, API or inference backend.

Run: python web_demo_v8.py
Or simply open index.html without Python.
"""
import argparse
import functools
import re
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class VideoHandler(SimpleHTTPRequestHandler):
    """Static files with byte-range support for reliable video seeking."""

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'application/javascript; charset=utf-8',
                      '.css': 'text/css; charset=utf-8',
                      '.html': 'text/html; charset=utf-8',
                      '.mp4': 'video/mp4', '.svg': 'image/svg+xml'}

    def list_directory(self, path):
        self.send_error(403, 'Directory listing is disabled')
        return None

    def send_head(self):
        self.byte_range = None
        path = Path(self.translate_path(self.path)).resolve()
        if not path.is_relative_to(ROOT):
            self.send_error(403)
            return None
        range_header = self.headers.get('Range')
        if not range_header or not path.is_file():
            return super().send_head()
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', range_header.strip())
        if not match or not any(match.groups()):
            self.send_error(416, 'Invalid byte range')
            return None
        try:
            stream = path.open('rb')
        except OSError:
            self.send_error(404)
            return None
        size = path.stat().st_size
        start_text, end_text = match.groups()
        if start_text:
            start = int(start_text)
            end = min(int(end_text), size - 1) if end_text else size - 1
        else:
            start = max(0, size - int(end_text))
            end = size - 1
        if start > end or start >= size:
            stream.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        self.byte_range = (start, end)
        stream.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Last-Modified', self.date_time_string(path.stat().st_mtime))
        self.end_headers()
        return stream

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def copyfile(self, source, outputfile):
        try:
            if self.byte_range is None:
                return super().copyfile(source, outputfile)
            remaining = self.byte_range[1] - self.byte_range[0] + 1
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


def main():
    parser = argparse.ArgumentParser(description='Local Tibetan VSR frontend preview')
    parser.add_argument('--port', type=int, default=7860)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not (ROOT / 'index.html').is_file():
        parser.error('Please keep this script alongside index.html and assets/.')
    handler = functools.partial(VideoHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as exc:
        parser.error(f'Cannot start on port {args.port}: {exc}. Try --port 7861.')
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'Tibetan VSR frontend: {url}', flush=True)
    print('Static preview only. Press Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nPreview stopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
