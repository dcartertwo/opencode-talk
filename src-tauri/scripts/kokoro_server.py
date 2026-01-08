#!/usr/bin/env python3
"""
Persistent Kokoro TTS Server
Keeps the model warm for fast sentence generation (~0.3s per sentence)
"""

import sys
import json
import os
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import soundfile as sf
import numpy as np

# Suppress warnings
import warnings
warnings.filterwarnings("ignore")

# Global pipeline (loaded once)
pipeline = None

def init_pipeline():
    global pipeline
    if pipeline is None:
        from kokoro import KPipeline
        pipeline = KPipeline(lang_code='a')
    return pipeline

class TTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress logging
    
    def do_POST(self):
        if self.path == '/tts':
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body)
                text = data.get('text', '')
                voice = data.get('voice', 'af_heart')
                speed = data.get('speed', 1.2)
                
                if not text:
                    self.send_error(400, 'Missing text')
                    return
                
                # Generate audio
                pipe = init_pipeline()
                generator = pipe(text, voice=voice, speed=speed)
                
                all_audio = []
                for gs, ps, audio in generator:
                    all_audio.extend(audio)
                
                if not all_audio:
                    self.send_error(500, 'No audio generated')
                    return
                
                # Write to temp file
                temp_file = tempfile.mktemp(suffix='.wav')
                sf.write(temp_file, np.array(all_audio), 24000)
                
                # Return file path
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'file': temp_file}).encode())
                
            except Exception as e:
                self.send_error(500, str(e))
        
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())
        
        else:
            self.send_error(404, 'Not found')
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'model_loaded': pipeline is not None}).encode())
        else:
            self.send_error(404, 'Not found')

def main():
    port = int(os.environ.get('KOKORO_PORT', 7892))
    init_pipeline()  # Pre-load the model
    server = HTTPServer(('127.0.0.1', port), TTSHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()

if __name__ == '__main__':
    main()
