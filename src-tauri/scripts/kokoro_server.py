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

def trim_silence(audio, sample_rate=24000, threshold_db=-40, min_silence_ms=100):
    """
    Trim trailing silence from audio.
    
    Args:
        audio: numpy array of audio samples
        sample_rate: audio sample rate
        threshold_db: silence threshold in dB (below this is considered silence)
        min_silence_ms: minimum silence duration to keep at the end (in milliseconds)
    """
    if len(audio) == 0:
        return audio
    
    # Convert threshold from dB to amplitude
    threshold = 10 ** (threshold_db / 20)
    
    # Find the last sample above threshold
    abs_audio = np.abs(audio)
    above_threshold = abs_audio > threshold
    
    if not np.any(above_threshold):
        # All silence, return minimal audio
        return audio[:int(sample_rate * 0.05)]  # 50ms
    
    # Find last non-silent sample
    last_sound_idx = np.max(np.where(above_threshold)[0])
    
    # Add a small buffer of silence at the end (for natural speech)
    min_silence_samples = int(sample_rate * min_silence_ms / 1000)
    end_idx = min(last_sound_idx + min_silence_samples, len(audio))
    
    return audio[:end_idx]

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
                
                # Convert to numpy array and trim trailing silence
                audio_array = np.array(all_audio)
                audio_array = trim_silence(audio_array, sample_rate=24000, 
                                          threshold_db=-40, min_silence_ms=50)
                
                # Write to temp file
                temp_file = tempfile.mktemp(suffix='.wav')
                sf.write(temp_file, audio_array, 24000)
                
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
